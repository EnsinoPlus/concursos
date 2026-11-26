"""Reportar erro em questão.

O aluno aponta um problema numa questão (gabarito, enunciado, explicação...). O reporte fica guardado
para a administração ver, corrigir a questão e marcar como resolvido ou descartado.
"""
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from main import consulta, exigir_login_se_ativo, pool, usuario_do_token

rota = APIRouter(prefix="/api")

MOTIVOS = {
    "gabarito": "Gabarito errado",
    "enunciado": "Erro no enunciado ou nas alternativas",
    "explicacao": "Explicação errada ou faltando",
    "desatualizada": "Questão desatualizada (lei mudou)",
    "outro": "Outro problema",
}
STATUS = {"aberto", "resolvido", "descartado"}

_tabela_pronta = False


def preparar_tabela():
    """Cria a tabela de reportes. Pode rodar várias vezes sem efeito colateral."""
    global _tabela_pronta
    if _tabela_pronta:
        return
    with pool.connection() as c:
        c.execute("""create table if not exists reportes(
            id serial primary key,
            questao text not null,
            motivo text not null,
            detalhe text,
            aluno_id uuid,
            email text,
            status text not null default 'aberto',
            criado_em timestamptz not null default now(),
            resolvido_em timestamptz)""")
        c.execute("create index if not exists reportes_status on reportes(status, criado_em desc)")
        c.execute("create index if not exists reportes_questao on reportes(questao)")
    _tabela_pronta = True


# Limite próprio: no máximo 10 reportes por hora para cada aluno (ou IP, sem login).
_envios: dict[str, deque] = defaultdict(deque)


def _limitar(quem: str):
    agora = time.time()
    fila = _envios[quem]
    while fila and agora - fila[0] > 3600:
        fila.popleft()
    if len(fila) >= 10:
        raise HTTPException(429, "Você já enviou muitos reportes nesta hora. Tente mais tarde.")
    fila.append(agora)


class Reporte(BaseModel):
    motivo: str
    detalhe: str = ""


@rota.post("/questoes/{qid}/reportar")
def reportar(qid: str, corpo: Reporte, request: Request):
    exigir_login_se_ativo(request)
    if corpo.motivo not in MOTIVOS:
        raise HTTPException(400, "Escolha o tipo de problema")
    detalhe = (corpo.detalhe or "").strip()[:1000] or None
    if corpo.motivo == "outro" and not detalhe:
        raise HTTPException(400, "Conte em poucas palavras qual é o problema")
    if not consulta("select 1 from questoes where id = %s", (qid,)):
        raise HTTPException(404, "Questão não encontrada")
    # Quem está logado fica identificado; sem login (página aberta) o reporte é anônimo.
    aluno = None
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        try:
            aluno = usuario_do_token(request)
        except HTTPException:
            aluno = None
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    _limitar(aluno["id"] if aluno else ip)
    if aluno and consulta("""select 1 from reportes where questao = %s and aluno_id = %s and motivo = %s
                             and status = 'aberto'""", (qid, aluno["id"], corpo.motivo)):
        return {"ok": True, "repetido": True}
    consulta("""insert into reportes(questao, motivo, detalhe, aluno_id, email) values(%s,%s,%s,%s,%s) returning id""",
             (qid, corpo.motivo, detalhe, aluno["id"] if aluno else None, aluno.get("email") if aluno else None))
    return {"ok": True}


# ---------- administração ----------
@rota.get("/admin/reportes")
def listar(request: Request, status: str = "aberto", limite: int = Query(50, ge=1, le=200),
           pagina: int = Query(0, ge=0)):
    from admin import exigir_admin

    exigir_admin(request)
    filtro, params = "", []
    if status in STATUS:
        filtro, params = "where r.status = %s", [status]
    linhas = consulta(
        f"""select r.id, r.questao, r.motivo, r.detalhe, r.email, r.status, r.criado_em, r.resolvido_em,
                   q.materia, q.enunciado, q.correta,
                   (select count(*) from reportes x where x.questao = r.questao and x.status = 'aberto')::int as abertos_da_questao
            from reportes r left join questoes q on q.id = r.questao {filtro}
            order by r.criado_em desc limit %s offset %s""",
        (*params, limite, pagina * limite))
    for l in linhas:
        l["motivo_texto"] = MOTIVOS.get(l["motivo"], l["motivo"])
    total = consulta(f"select count(*) n from reportes r {filtro}", params)[0]["n"]
    abertos = consulta("select count(*) n from reportes where status = 'aberto'")[0]["n"]
    return {"total": total, "abertos": abertos, "reportes": linhas}


class NovoStatus(BaseModel):
    status: str
    todos_da_questao: bool = False


@rota.patch("/admin/reportes/{rid}")
def mudar_status(rid: int, corpo: NovoStatus, request: Request):
    from admin import exigir_admin, registrar

    adm = exigir_admin(request)
    if corpo.status not in STATUS:
        raise HTTPException(400, "Situação inválida")
    r = consulta("select questao from reportes where id = %s", (rid,))
    if not r:
        raise HTTPException(404, "Reporte não encontrado")
    quando = "now()" if corpo.status != "aberto" else "null"
    if corpo.todos_da_questao:
        ids = consulta(f"""update reportes set status = %s, resolvido_em = {quando}
                           where questao = %s and status = 'aberto' returning id""", (corpo.status, r[0]["questao"]))
    else:
        ids = consulta(f"update reportes set status = %s, resolvido_em = {quando} where id = %s returning id",
                       (corpo.status, rid))
    registrar(adm, "reporte_" + corpo.status, r[0]["questao"], {"reportes": [i["id"] for i in ids]})
    return {"ok": True, "alterados": len(ids)}

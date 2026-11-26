"""Área administrativa — exige login de um usuário da tabela admins.
Toda alteração fica registrada em admin_log."""
import datetime
import os
import re
import time
import unicodedata
import uuid
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException, Query, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from conteudo import validar as validar_texto
from main import consulta, expirar_planos, pool, usuario_do_token

rota = APIRouter(prefix="/api/admin")
PLANOS = {"gratuito", "mensal", "anual", "bloqueado"}
ORIGENS = {"manual", "cortesia", "hotmart", "asaas", "outro"}
UFS = {"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
       "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"}


def _data(v):
    """Vazio vira nulo; texto AAAA-MM-DD vira data."""
    if v is None or not str(v).strip():
        return None
    try:
        return datetime.date.fromisoformat(str(v).strip())
    except ValueError:
        raise HTTPException(400, "Data de validade inválida")


def _zap(v):
    z = re.sub(r"\D", "", v or "")
    if z and not 10 <= len(z) <= 13:
        raise HTTPException(400, "WhatsApp inválido. Use DDD + número")
    return z or None


def _uf(v):
    u = (v or "").strip().upper()
    if u and u not in UFS:
        raise HTTPException(400, "Estado inválido")
    return u or None


def _txt(v, n):
    return (v or "").strip()[:n] or None
# Administrador principal: sempre tem acesso e não pode ser removido.
ADMIN_PRINCIPAL = os.environ.get("ADMIN_PRINCIPAL", "").strip().lower()


def eh_principal(u: dict) -> bool:
    return bool(ADMIN_PRINCIPAL) and (u.get("email") or "").strip().lower() == ADMIN_PRINCIPAL and bool(u.get("email_confirmed_at") or u.get("confirmed_at"))


# Interruptor: com ADMIN_SEM_LOGIN=1 a administração abre SEM login para qualquer pessoa que souber o endereço.
# Fica desligado por padrão. Quem tiver acesso ao endereço vê dados dos alunos e pode editar ou apagar conteúdo.
# Para voltar a exigir login, apague a variável (ou ponha 0) e reimplante.
ADMIN_SEM_LOGIN = os.environ.get("ADMIN_SEM_LOGIN", "").strip().lower() in ("1", "true", "sim", "s")
if ADMIN_SEM_LOGIN:
    print("AVISO: ADMIN_SEM_LOGIN ligado. A administração está aberta sem login.")
_ADMIN_ANONIMO = {"id": "00000000-0000-0000-0000-000000000000", "email": "(sem login)"}


def exigir_admin(request: Request) -> dict:
    if ADMIN_SEM_LOGIN:
        return _ADMIN_ANONIMO
    u = usuario_do_token(request)
    if eh_principal(u):
        meta = u.get("user_metadata") or {}
        consulta("insert into alunos(id, email, nome) values(%s,%s,%s) on conflict(id) do nothing returning id",
                 (u["id"], u.get("email"), meta.get("full_name") or meta.get("name")))
        consulta("insert into admins(id) values(%s) on conflict do nothing returning id", (u["id"],))
        return u
    if not consulta("select 1 from admins where id = %s", (u["id"],)):
        raise HTTPException(403, "Acesso restrito aos administradores")
    return u


def id_principal():
    r = consulta("select id from alunos where lower(email) = %s", (ADMIN_PRINCIPAL,))
    return str(r[0]["id"]) if r else None


def _limpo(linha: dict) -> dict:
    return {k: (str(v) if hasattr(v, "isoformat") or isinstance(v, uuid.UUID) else v) for k, v in linha.items()}


def registrar(admin: dict, acao: str, alvo: str, detalhe: Any = None):
    consulta("insert into admin_log(admin_id, acao, alvo, detalhe) values(%s,%s,%s,%s) returning id",
             (admin["id"], acao, alvo, Jsonb(detalhe)))


@rota.get("/eu")
def eu(request: Request):
    u = exigir_admin(request)
    return {"id": u["id"], "email": u.get("email"), "sem_login": ADMIN_SEM_LOGIN}


@rota.get("/resumo")
def resumo(request: Request):
    exigir_admin(request)
    expirar_planos()
    return consulta("""select
        (select count(*) from alunos) as alunos,
        (select count(*) from alunos where ultimo_acesso > now() - interval '7 days') as ativos_7d,
        (select count(*) from questoes) as questoes,
        (select count(*) from questoes where not revisada) as questoes_nao_revisadas,
        (select count(*) from flashcards) as flashcards,
        (select count(*) from reportes where status = 'aberto') as reportes_abertos,
        (select count(*) from progresso) as alunos_com_progresso,
        (select coalesce(sum((select count(*) from jsonb_object_keys(coalesce(dados->'respostas', '{}'::jsonb)))), 0)
           from progresso) as respostas_total""")[0]


# ---------- alunos ----------
@rota.get("/alunos")
def alunos(request: Request, busca: str = "", limite: int = Query(50, ge=1, le=200), pagina: int = Query(0, ge=0)):
    exigir_admin(request)
    expirar_planos()
    termo = f"%{busca.strip().lower()}%"
    linhas = consulta(
        """select a.id, a.email, a.nome, a.plano, a.plano_validade, a.origem, a.observacao, a.whatsapp, a.cidade, a.uf,
                  a.concurso_alvo, a.primeiro_acesso, a.ultimo_acesso, a.acessos,
                  exists(select 1 from admins x where x.id = a.id) as admin
           from alunos a where lower(a.email) like %s or lower(coalesce(a.nome, '')) like %s
           order by a.ultimo_acesso desc limit %s offset %s""",
        (termo, termo, limite, pagina * limite))
    total = consulta("select count(*) n from alunos where lower(email) like %s or lower(coalesce(nome, '')) like %s",
                     (termo, termo))[0]["n"]
    pre = consulta("""select email, nome, plano, plano_validade, origem, criado_em from alunos_pre
                      where email like %s or lower(coalesce(nome, '')) like %s order by criado_em desc""", (termo, termo))
    return {"total": total, "alunos": linhas, "pre": pre}


class NovoAluno(BaseModel):
    email: str
    nome: str = ""
    plano: str = "gratuito"
    plano_validade: str = ""
    origem: str = "manual"
    observacao: str = ""
    whatsapp: str = ""
    cidade: str = ""
    uf: str = ""
    concurso_alvo: str = ""


@rota.post("/alunos")
def adicionar_aluno(corpo: NovoAluno, request: Request):
    """Cadastra um aluno à mão. A conta é criada pela própria pessoa no primeiro login
    (mesmo e-mail da conta Ensino Plus); nesse momento os dados daqui passam a valer."""
    adm = exigir_admin(request)
    email = corpo.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "E-mail inválido")
    if corpo.plano not in PLANOS:
        raise HTTPException(400, "Plano inválido")
    if corpo.origem not in ORIGENS:
        raise HTTPException(400, "Origem inválida")
    validade = _data(corpo.plano_validade) if corpo.plano in ("mensal", "anual") else None
    if validade and validade < datetime.date.today():
        raise HTTPException(400, "A validade já passou")
    if consulta("select 1 from alunos where lower(email) = %s", (email,)):
        raise HTTPException(400, "Este e-mail já é aluno. Mude os dados na lista.")
    consulta("""insert into alunos_pre(email, nome, plano, plano_validade, origem, observacao, whatsapp, cidade, uf,
                  concurso_alvo, criado_por) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                on conflict(email) do update set nome = excluded.nome, plano = excluded.plano,
                  plano_validade = excluded.plano_validade, origem = excluded.origem, observacao = excluded.observacao,
                  whatsapp = excluded.whatsapp, cidade = excluded.cidade, uf = excluded.uf,
                  concurso_alvo = excluded.concurso_alvo returning email""",
             (email, _txt(corpo.nome, 120), corpo.plano, validade, corpo.origem, _txt(corpo.observacao, 500),
              _zap(corpo.whatsapp), _txt(corpo.cidade, 80), _uf(corpo.uf), _txt(corpo.concurso_alvo, 120), adm["id"]))
    registrar(adm, "pre_cadastrar_aluno", email, {"plano": corpo.plano, "origem": corpo.origem})
    return {"ok": True}


@rota.delete("/alunos/pre/{email}")
def cancelar_pre_cadastro(email: str, request: Request):
    adm = exigir_admin(request)
    if not consulta("delete from alunos_pre where email = %s returning email", (email.strip().lower(),)):
        raise HTTPException(404, "Cadastro não encontrado")
    registrar(adm, "cancelar_pre_cadastro", email)
    return {"ok": True}


class AlunoEdicao(BaseModel):
    nome: str | None = None
    plano: str | None = None
    admin: bool | None = None
    plano_validade: str | None = None
    origem: str | None = None
    observacao: str | None = None
    whatsapp: str | None = None
    cidade: str | None = None
    uf: str | None = None
    concurso_alvo: str | None = None


@rota.patch("/alunos/{aid}")
def editar_aluno(aid: str, corpo: AlunoEdicao, request: Request):
    adm = exigir_admin(request)
    if corpo.plano is not None and corpo.plano not in PLANOS:
        raise HTTPException(400, "Plano inválido")
    if not consulta("select 1 from alunos where id = %s", (aid,)):
        raise HTTPException(404, "Aluno não encontrado")
    if corpo.admin is False and aid == adm["id"]:
        raise HTTPException(400, "Você não pode tirar o seu próprio acesso de administrador")
    if corpo.admin is False and aid == id_principal():
        raise HTTPException(400, "O administrador principal não pode ser removido")
    if corpo.nome is not None:
        consulta("update alunos set nome = %s where id = %s returning id", (corpo.nome.strip() or None, aid))
    if corpo.plano is not None:
        consulta("update alunos set plano = %s where id = %s returning id", (corpo.plano, aid))
    if corpo.origem is not None:
        if corpo.origem not in ORIGENS:
            raise HTTPException(400, "Origem inválida")
        consulta("update alunos set origem = %s where id = %s returning id", (corpo.origem, aid))
    if corpo.plano_validade is not None:
        consulta("update alunos set plano_validade = %s where id = %s returning id", (_data(corpo.plano_validade), aid))
    for campo, valor in (("observacao", _txt(corpo.observacao, 500)), ("cidade", _txt(corpo.cidade, 80)),
                         ("concurso_alvo", _txt(corpo.concurso_alvo, 120))):
        if getattr(corpo, campo) is not None:
            consulta(f"update alunos set {campo} = %s where id = %s returning id", (valor, aid))
    if corpo.whatsapp is not None:
        consulta("update alunos set whatsapp = %s where id = %s returning id", (_zap(corpo.whatsapp), aid))
    if corpo.uf is not None:
        consulta("update alunos set uf = %s where id = %s returning id", (_uf(corpo.uf), aid))
    # Validade só faz sentido em plano pago.
    consulta("update alunos set plano_validade = null where id = %s and plano in ('gratuito', 'bloqueado') returning id", (aid,))
    if corpo.admin is True:
        consulta("insert into admins(id) values(%s) on conflict do nothing returning id", (aid,))
    elif corpo.admin is False:
        consulta("delete from admins where id = %s returning id", (aid,))
    registrar(adm, "editar_aluno", aid, corpo.model_dump(exclude_none=True))
    return {"ok": True}


# ---------- questões ----------
class QuestaoDados(BaseModel):
    id: str | None = None
    materia: str
    enunciado: str
    alternativas: dict[str, str]
    correta: str
    comentario: str = ""
    fonte: str = "Ensino Plus (autoral)"
    revisada: bool = False


def _validar_questao(q: QuestaoDados) -> dict:
    if not consulta("select 1 from materias where id = %s", (q.materia,)):
        raise HTTPException(400, "Matéria inválida")
    alts = {k.strip().upper(): v.strip() for k, v in q.alternativas.items() if v and v.strip()}
    if len(alts) < 2:
        raise HTTPException(400, "Informe pelo menos duas alternativas")
    if q.correta.strip().upper() not in alts:
        raise HTTPException(400, "A resposta correta precisa ser uma das alternativas preenchidas")
    if not q.enunciado.strip():
        raise HTTPException(400, "Enunciado vazio")
    return alts


@rota.get("/questoes")
def questoes(request: Request, materia: str = "", busca: str = "", revisada: str = "",
             limite: int = Query(50, ge=1, le=200), pagina: int = Query(0, ge=0)):
    exigir_admin(request)
    filtros, params = [], []
    if materia:
        filtros.append("materia = %s")
        params.append(materia)
    if busca.strip():
        filtros.append("(lower(enunciado) like %s or lower(id) like %s)")
        params += [f"%{busca.strip().lower()}%"] * 2
    if revisada in ("sim", "nao"):
        filtros.append("revisada = %s")
        params.append(revisada == "sim")
    where = ("where " + " and ".join(filtros)) if filtros else ""
    linhas = consulta(f"""select questoes.*, (select count(*) from reportes r where r.questao = questoes.id
                                               and r.status = 'aberto')::int as reportes
                          from questoes {where} order by criada_em desc, id limit %s offset %s""",
                      (*params, limite, pagina * limite))
    total = consulta(f"select count(*) n from questoes {where}", params)[0]["n"]
    return {"total": total, "questoes": linhas}


@rota.post("/questoes")
def criar_questao(q: QuestaoDados, request: Request):
    adm = exigir_admin(request)
    alts = _validar_questao(q)
    qid = (q.id or "").strip() or f"{q.materia[:3]}-{int(time.time() * 1000)}"
    if consulta("select 1 from questoes where id = %s", (qid,)):
        raise HTTPException(400, "Já existe uma questão com esse código")
    consulta("""insert into questoes(id, materia, enunciado, alternativas, correta, comentario, fonte, revisada)
                values(%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
             (qid, q.materia, q.enunciado.strip(), Jsonb(alts), q.correta.strip().upper(),
              q.comentario.strip(), q.fonte.strip(), q.revisada))
    registrar(adm, "criar_questao", qid)
    return {"ok": True, "id": qid}


@rota.put("/questoes/{qid}")
def editar_questao(qid: str, q: QuestaoDados, request: Request):
    adm = exigir_admin(request)
    alts = _validar_questao(q)
    antes = consulta("select * from questoes where id = %s", (qid,))
    if not antes:
        raise HTTPException(404, "Questão não encontrada")
    consulta("""update questoes set materia=%s, enunciado=%s, alternativas=%s, correta=%s, comentario=%s,
                fonte=%s, revisada=%s where id=%s returning id""",
             (q.materia, q.enunciado.strip(), Jsonb(alts), q.correta.strip().upper(), q.comentario.strip(),
              q.fonte.strip(), q.revisada, qid))
    registrar(adm, "editar_questao", qid, {"antes": _limpo(antes[0])})
    return {"ok": True}


@rota.delete("/questoes/{qid}")
def apagar_questao(qid: str, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select * from questoes where id = %s", (qid,))
    if not antes:
        raise HTTPException(404, "Questão não encontrada")
    consulta("delete from questoes where id = %s returning id", (qid,))
    registrar(adm, "apagar_questao", qid, _limpo(antes[0]))
    return {"ok": True}


# ---------- flashcards ----------
class CardDados(BaseModel):
    materia: str
    frente: str
    verso: str


@rota.get("/flashcards")
def cards(request: Request, materia: str = ""):
    exigir_admin(request)
    if materia:
        return consulta("select * from flashcards where materia = %s order by id", (materia,))
    return consulta("select * from flashcards order by id")


@rota.post("/flashcards")
def criar_card(c: CardDados, request: Request):
    adm = exigir_admin(request)
    if not consulta("select 1 from materias where id = %s", (c.materia,)):
        raise HTTPException(400, "Matéria inválida")
    try:
        cid = consulta("insert into flashcards(materia, frente, verso) values(%s,%s,%s) returning id",
                       (c.materia, c.frente.strip(), c.verso.strip()))[0]["id"]
    except psycopg.errors.UniqueViolation:
        raise HTTPException(400, "Já existe um flashcard com essa frente")
    registrar(adm, "criar_flashcard", str(cid))
    return {"ok": True, "id": cid}


@rota.put("/flashcards/{cid}")
def editar_card(cid: int, c: CardDados, request: Request):
    adm = exigir_admin(request)
    if not consulta("select 1 from materias where id = %s", (c.materia,)):
        raise HTTPException(400, "Matéria inválida")
    antes = consulta("select materia, frente, verso from flashcards where id = %s", (cid,))
    if not antes:
        raise HTTPException(404, "Flashcard não encontrado")
    consulta("update flashcards set materia=%s, frente=%s, verso=%s where id=%s returning id",
             (c.materia, c.frente.strip(), c.verso.strip(), cid))
    registrar(adm, "editar_flashcard", str(cid), {"antes": antes[0]})
    return {"ok": True}


@rota.delete("/flashcards/{cid}")
def apagar_card(cid: int, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select materia, frente, verso from flashcards where id = %s", (cid,))
    if not antes:
        raise HTTPException(404, "Flashcard não encontrado")
    consulta("delete from flashcards where id = %s returning id", (cid,))
    registrar(adm, "apagar_flashcard", str(cid), antes[0])
    return {"ok": True}


# ---------- matérias (nome e tópicos do edital) ----------
class MateriaDados(BaseModel):
    nome: str
    topicos: list[str]
    comum: bool | None = None


@rota.put("/materias/{mid}")
def editar_materia(mid: str, m: MateriaDados, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select nome, topicos from materias where id = %s", (mid,))
    if not antes:
        raise HTTPException(404, "Matéria não encontrada")
    tops = [t.strip() for t in m.topicos if t.strip()]
    if not m.nome.strip():
        raise HTTPException(400, "Informe o nome da matéria")
    consulta("update materias set nome=%s, topicos=%s where id=%s returning id", (m.nome.strip(), Jsonb(tops), mid))
    if m.comum is not None:
        consulta("update materias set comum=%s where id=%s returning id", (m.comum, mid))
    registrar(adm, "editar_materia", mid, {"antes": antes[0]})
    return {"ok": True}


def _slug(nome: str, tabela: str) -> str:
    base = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "", base)[:30] or "item"
    novo, n = base, 2
    while consulta(f"select 1 from {tabela} where id = %s", (novo,)):
        novo = f"{base}{n}"
        n += 1
    return novo


@rota.post("/materias")
def criar_materia(m: MateriaDados, request: Request):
    adm = exigir_admin(request)
    if not m.nome.strip():
        raise HTTPException(400, "Informe o nome da matéria")
    mid = _slug(m.nome, "materias")
    tops = [t.strip() for t in m.topicos if t.strip()]
    consulta("insert into materias(id, nome, comum, topicos) values(%s,%s,%s,%s) returning id",
             (mid, m.nome.strip(), bool(m.comum), Jsonb(tops)))
    registrar(adm, "criar_materia", mid)
    return {"ok": True, "id": mid}


@rota.delete("/materias/{mid}")
def apagar_materia(mid: str, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select nome, comum, topicos from materias where id = %s", (mid,))
    if not antes:
        raise HTTPException(404, "Matéria não encontrada")
    nq = consulta("select count(*) n from questoes where materia = %s", (mid,))[0]["n"]
    nf = consulta("select count(*) n from flashcards where materia = %s", (mid,))[0]["n"]
    if nq or nf:
        raise HTTPException(400, f"Esta matéria tem {nq} questões e {nf} flashcards. Apague ou mude esses itens antes.")
    consulta("update areas set materias = array_remove(materias, %s) where %s = any(materias) returning id", (mid, mid))
    consulta("delete from materias where id = %s returning id", (mid,))
    registrar(adm, "apagar_materia", mid, antes[0])
    return {"ok": True}


# ---------- áreas ----------
CORES = {"blue", "indigo", "slate", "emerald", "amber", "rose", "violet", "cyan"}


class AreaDados(BaseModel):
    nome: str
    descricao: str = ""
    icone: str = "briefcase"
    cor: str = "blue"
    cargos: list[str] = []
    materias: list[str] = []


def _validar_area(a: AreaDados):
    if not a.nome.strip():
        raise HTTPException(400, "Informe o nome da área")
    if a.cor not in CORES:
        raise HTTPException(400, "Cor inválida")
    if not re.fullmatch(r"[a-z0-9-]{2,40}", a.icone):
        raise HTTPException(400, "Ícone inválido")
    existentes = {r["id"] for r in consulta("select id from materias")}
    if any(m not in existentes for m in a.materias):
        raise HTTPException(400, "Matéria inexistente na lista")
    return [c.strip() for c in a.cargos if c.strip()], list(dict.fromkeys(a.materias))


@rota.post("/areas")
def criar_area(a: AreaDados, request: Request):
    adm = exigir_admin(request)
    cargos, mats = _validar_area(a)
    aid = _slug(a.nome, "areas")
    consulta("insert into areas(id, nome, icone, cor, descricao, cargos, materias) values(%s,%s,%s,%s,%s,%s,%s) returning id",
             (aid, a.nome.strip(), a.icone, a.cor, a.descricao.strip(), Jsonb(cargos), mats))
    registrar(adm, "criar_area", aid)
    return {"ok": True, "id": aid}


@rota.put("/areas/{aid}")
def editar_area(aid: str, a: AreaDados, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select * from areas where id = %s", (aid,))
    if not antes:
        raise HTTPException(404, "Área não encontrada")
    cargos, mats = _validar_area(a)
    consulta("update areas set nome=%s, icone=%s, cor=%s, descricao=%s, cargos=%s, materias=%s where id=%s returning id",
             (a.nome.strip(), a.icone, a.cor, a.descricao.strip(), Jsonb(cargos), mats, aid))
    registrar(adm, "editar_area", aid, {"antes": _limpo(antes[0])})
    return {"ok": True}


@rota.delete("/areas/{aid}")
def apagar_area(aid: str, request: Request):
    adm = exigir_admin(request)
    antes = consulta("select * from areas where id = %s", (aid,))
    if not antes:
        raise HTTPException(404, "Área não encontrada")
    if consulta("select count(*) n from areas")[0]["n"] <= 1:
        raise HTTPException(400, "A página precisa ter pelo menos uma área")
    consulta("delete from areas where id = %s returning id", (aid,))
    registrar(adm, "apagar_area", aid, _limpo(antes[0]))
    return {"ok": True}


# ---------- apagar aluno ----------
@rota.delete("/alunos/{aid}")
def apagar_aluno(aid: str, request: Request):
    adm = exigir_admin(request)
    if aid == adm["id"]:
        raise HTTPException(400, "Você não pode apagar a si mesmo")
    if aid == id_principal():
        raise HTTPException(400, "O administrador principal não pode ser apagado")
    antes = consulta("""select id, email, nome, plano, plano_validade, origem, observacao, whatsapp, cidade, uf,
                               concurso_alvo, primeiro_acesso, ultimo_acesso, acessos from alunos where id = %s""", (aid,))
    if not antes:
        raise HTTPException(404, "Aluno não encontrado")
    if consulta("select 1 from admins where id = %s", (aid,)):
        raise HTTPException(400, "Este aluno é administrador. Remova o acesso de administrador antes.")
    consulta("delete from alunos where id = %s returning id", (aid,))
    registrar(adm, "apagar_aluno", antes[0]["email"], _limpo(antes[0]))
    return {"ok": True}


# ---------- importação de questões em lote ----------
class LoteQuestoes(BaseModel):
    questoes: list[dict]
    fonte: str = ""
    aplicar: bool = False  # false = só confere (simulação); true = grava


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower())


@rota.post("/questoes/importar")
def importar_questoes(lote: LoteQuestoes, request: Request):
    adm = exigir_admin(request)
    if not lote.questoes:
        raise HTTPException(400, "Nenhuma questão no arquivo")
    if len(lote.questoes) > 2000:
        raise HTTPException(400, "Máximo de 2000 questões por importação")
    mats = consulta("select id, nome from materias")
    por_chave = {}
    for m in mats:
        por_chave[_norm(m["id"])] = m["id"]
        por_chave[_norm(m["nome"])] = m["id"]
    ids_existentes = {r["id"] for r in consulta("select id from questoes")}
    vistos, validas, erros = set(), [], []
    for i, q in enumerate(lote.questoes, start=1):
        linha = i + 1  # linha 1 do arquivo é o cabeçalho
        try:
            mat = por_chave.get(_norm(str(q.get("materia", ""))))
            if not mat:
                raise ValueError("matéria não encontrada: " + str(q.get("materia", "")))
            enun = str(q.get("enunciado", "")).strip()
            if not enun:
                raise ValueError("enunciado vazio")
            alts = q.get("alternativas") if isinstance(q.get("alternativas"), dict) else {l: q.get(l) or q.get(l.lower()) for l in "ABCDE"}
            alts = {str(k).strip().upper(): str(v).strip() for k, v in alts.items() if v is not None and str(v).strip()}
            if len(alts) < 2:
                raise ValueError("menos de 2 alternativas")
            cor = str(q.get("correta", "")).strip().upper()[:1]
            if cor not in alts:
                raise ValueError("gabarito não é uma das alternativas")
            qid = str(q.get("id") or "").strip() or f"{mat[:3]}-{int(time.time() * 1000)}-{i}"
            if qid in ids_existentes or qid in vistos:
                raise ValueError(f"código repetido: {qid}")
            vistos.add(qid)
            rev = str(q.get("revisada", "")).strip().lower() in ("1", "sim", "true", "s")
            fonte = str(q.get("fonte") or lote.fonte or "Importada").strip()[:120]
            validas.append((qid, mat, enun, Jsonb(alts), cor, str(q.get("comentario") or "").strip(), fonte, rev))
        except ValueError as e:
            erros.append({"linha": linha, "erro": str(e)})
    if lote.aplicar and validas:
        with pool.connection() as c:
            c.cursor().executemany(
                """insert into questoes(id, materia, enunciado, alternativas, correta, comentario, fonte, revisada)
                   values(%s,%s,%s,%s,%s,%s,%s,%s)""", validas)
        registrar(adm, "importar_questoes", f"{len(validas)} questões", {"fonte": lote.fonte, "ignoradas": len(erros)})
    return {"validas": len(validas), "erros": erros[:200], "total_erros": len(erros), "gravadas": len(validas) if lote.aplicar else 0}


@rota.get("/historico")
def historico(request: Request, limite: int = Query(100, ge=1, le=500)):
    exigir_admin(request)
    return consulta("""select l.id, l.acao, l.alvo, l.criado_em, a.email as admin
                       from admin_log l left join alunos a on a.id = l.admin_id order by l.id desc limit %s""",
                    (limite,))


# ---------- administradores ----------
@rota.get("/admins")
def listar_admins(request: Request):
    exigir_admin(request)
    principal = id_principal()
    admins = consulta("""select a.id, a.email, a.nome, x.criado_em from admins x join alunos a on a.id = x.id
                         order by x.criado_em""")
    for a in admins:
        a["principal"] = str(a["id"]) == principal
    convites = consulta("""select c.email, c.criado_em, a.email as convidado_por from admin_convites c
                           left join alunos a on a.id = c.criado_por order by c.criado_em""")
    return {"admins": admins, "convites": convites}


class NovoAdmin(BaseModel):
    email: str


@rota.post("/admins")
def adicionar_admin(corpo: NovoAdmin, request: Request):
    """Dá acesso de admin pelo e-mail. Se a pessoa ainda não entrou na página,
    fica como convite e vira admin no primeiro login."""
    adm = exigir_admin(request)
    email = corpo.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "E-mail inválido")
    aluno = consulta("select id from alunos where lower(email) = %s", (email,))
    if aluno:
        consulta("insert into admins(id) values(%s) on conflict do nothing returning id", (aluno[0]["id"],))
        registrar(adm, "adicionar_admin", email)
        return {"ok": True, "situacao": "admin"}
    consulta("insert into admin_convites(email, criado_por) values(%s,%s) on conflict(email) do nothing returning email",
             (email, adm["id"]))
    registrar(adm, "convidar_admin", email)
    return {"ok": True, "situacao": "convite"}


@rota.delete("/admins/convites/{email}")
def cancelar_convite(email: str, request: Request):
    adm = exigir_admin(request)
    if not consulta("delete from admin_convites where email = %s returning email", (email.strip().lower(),)):
        raise HTTPException(404, "Convite não encontrado")
    registrar(adm, "cancelar_convite", email)
    return {"ok": True}


@rota.delete("/admins/{aid}")
def remover_admin(aid: str, request: Request):
    adm = exigir_admin(request)
    if aid == adm["id"]:
        raise HTTPException(400, "Você não pode tirar o seu próprio acesso de administrador")
    if aid == id_principal():
        raise HTTPException(400, "O administrador principal não pode ser removido")
    if not consulta("delete from admins where id = %s returning id", (aid,)):
        raise HTTPException(404, "Administrador não encontrado")
    registrar(adm, "remover_admin", aid)
    return {"ok": True}


# ---------- desempenho de um aluno ----------
@rota.get("/alunos/{aid}/desempenho")
def desempenho(aid: str, request: Request):
    exigir_admin(request)
    al = consulta("select id, email, nome from alunos where id = %s", (aid,))
    if not al:
        raise HTTPException(404, "Aluno não encontrado")
    base = {"aluno": {"email": al[0]["email"], "nome": al[0]["nome"]}}
    linha = consulta("select dados, atualizado from progresso where aluno_id = %s", (aid,))
    if not linha:
        return {**base, "sem_progresso": True}
    d = linha[0]["dados"]
    resp = d.get("respostas") or {}
    mats = {r["id"]: r["materia"] for r in consulta("select id, materia from questoes where id = any(%s)", (list(resp.keys()),))}
    nomes = {m["id"]: m["nome"] for m in consulta("select id, nome from materias")}
    por, total, acertos = {}, 0, 0
    for qid, r in resp.items():
        if not isinstance(r, dict):
            continue
        ok = bool(r.get("acertou"))
        total += 1
        acertos += ok
        nome = nomes.get(mats.get(qid), "Questões removidas")
        s = por.setdefault(nome, {"materia": nome, "total": 0, "acertos": 0})
        s["total"] += 1
        s["acertos"] += ok
    dias = {x for x in (d.get("dias") or []) if isinstance(x, str)}
    hoje = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=3)).date()
    cur = hoje if hoje.isoformat() in dias else hoje - datetime.timedelta(days=1)
    seq = 0
    while cur.isoformat() in dias:
        seq += 1
        cur -= datetime.timedelta(days=1)
    areas = {r["id"]: r["nome"] for r in consulta("select id, nome from areas")}
    edital = {areas.get(a, a): sum(1 for v in (marcas or {}).values() if v)
              for a, marcas in (d.get("edital") or {}).items() if isinstance(marcas, dict)}
    red = d.get("redacao") or {}
    return {**base, "sem_progresso": False, "atualizado": linha[0]["atualizado"],
            "respondidas": total, "acertos": acertos,
            "por_materia": sorted(por.values(), key=lambda x: x["materia"]),
            "dias_estudados": len(dias), "sequencia": seq, "ultimo_dia": max(dias) if dias else None,
            "flashcards_revisados": len(d.get("srs") or {}), "flashcards_criados": len(d.get("cardsCriados") or []),
            "edital_topicos": edital,
            "redacao_palavras": len(re.findall(r"\S+", str(red.get("texto", ""))))}


# ---------- textos editáveis da página ----------
class TextoDados(BaseModel):
    valor: Any


@rota.put("/conteudo/{chave}")
def editar_texto(chave: str, corpo: TextoDados, request: Request):
    adm = exigir_admin(request)
    linha = consulta("select valor from conteudo where chave = %s", (chave,))
    if not linha:
        raise HTTPException(404, "Texto não encontrado")
    novo = validar_texto(chave, corpo.valor, linha[0]["valor"])
    consulta("update conteudo set valor = %s, atualizado = now() where chave = %s returning chave", (Jsonb(novo), chave))
    registrar(adm, "editar_texto", chave, {"antes": linha[0]["valor"]})
    return {"ok": True}

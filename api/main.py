"""API do Ensino Plus Concursos.

Intermediária entre a página e o banco `concursos`. A senha do banco fica só aqui
no servidor; a página nunca recebe o gabarito antes de o aluno responder.

Configuração (variáveis de ambiente):
  DATABASE_URL  URL do Postgres apontando para o banco `concursos` (obrigatória).
  CORS_ORIGINS  domínios liberados, separados por vírgula (padrão: *).
"""
import os
import random
import time
from collections import defaultdict, deque

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


def _url_banco() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Defina a variável de ambiente DATABASE_URL (URL do Postgres do banco concursos)")
    return url


pool = ConnectionPool(_url_banco(), min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)

SITE_DIR = os.environ.get("SITE_DIR")  # publicado: a API também serve a página (um só serviço)
app = FastAPI(title="Ensino Plus Concursos API", version="0.1.0",
              docs_url=None if SITE_DIR else "/docs", redoc_url=None, openapi_url=None if SITE_DIR else "/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "" if SITE_DIR else "*").split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Limite simples por IP: impede baixar o banco inteiro (exigência dos termos da QAPI).
LIMITE_POR_MINUTO = int(os.environ.get("LIMITE_POR_MINUTO", "60"))
_acessos: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def limitar(request: Request, call_next):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    agora = time.time()
    fila = _acessos[ip]
    while fila and agora - fila[0] > 60:
        fila.popleft()
    if len(fila) >= LIMITE_POR_MINUTO:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Muitas requisições. Aguarde um minuto."}, status_code=429)
    fila.append(agora)
    return await call_next(request)


def consulta(sql: str, params=()):
    with pool.connection() as c:
        return c.execute(sql, params).fetchall()


# Interruptor de acesso (administração > Textos da página > Acesso): exigir login para estudar?
# Sem a chave no banco, o padrão é exigir (mais seguro). Guardado por 10 segundos.
_cache_acesso = [0.0, True]


def login_obrigatorio() -> bool:
    agora = time.time()
    if agora - _cache_acesso[0] > 10:
        try:
            linha = consulta("select valor from conteudo where chave = 'acesso'")
            _cache_acesso[1] = (linha[0]["valor"].get("login_obrigatorio", True) is not False) if linha else True
        except Exception:
            _cache_acesso[1] = True
        _cache_acesso[0] = agora
    return _cache_acesso[1]


def exigir_login_se_ativo(request: Request):
    if login_obrigatorio():
        usuario_do_token(request)


@app.get("/api/saude")
def saude():
    consulta("select 1")
    return {"ok": True}


@app.get("/api/areas")
def areas():
    return consulta("select id, nome, icone, cor, descricao, cargos, materias from areas order by nome")


@app.get("/api/materias")
def materias():
    # total_questoes: quantas questões a matéria tem no banco (a página usa para mostrar "56 de 564").
    return consulta("""select m.id, m.nome, m.comum, m.topicos,
                              (select count(*) from questoes q where q.materia = m.id)::int as total_questoes
                       from materias m order by m.comum desc, m.nome""")


@app.get("/api/questoes")
def questoes(
    request: Request,
    materia: str | None = None,
    area: str | None = None,
    limite: int = Query(10, ge=1, le=100),
    excluir: str | None = Query(None, description="ids já vistos, separados por vírgula"),
    pagina: int | None = Query(None, ge=0, description="carga em páginas (pagina*limite é o ponto de partida)"),
    inicio: int | None = Query(None, ge=0, description="ponto de partida exato; tem prioridade sobre pagina"),
    semente: str = Query("", max_length=40, description="muda o sorteio; com a mesma semente a ordem se repete"),
):
    """Devolve questões SEM gabarito e SEM comentário. Só para quem fez login (protege o banco de cópia anônima).

    Sem `pagina` nem `inicio`: sorteia até 20 questões (modo antigo, com `excluir`).
    Com `pagina` ou `inicio`: devolve até `limite` (máx. 100) questões a partir daquele ponto, numa ordem que se repete
    para a mesma `semente` e que alterna entre as matérias (1ª de cada matéria, 2ª de cada, ...). Assim a página
    carrega a área em lotes e nunca depende de mandar a lista das já recebidas na URL (o modo antigo não funciona
    com milhares de questões, pois `excluir` aceita só 500 códigos)."""
    exigir_login_se_ativo(request)
    em_lotes = pagina is not None or inicio is not None
    if not em_lotes:
        limite = min(limite, 20)
    filtros, params = [], []
    if materia:
        filtros.append("q.materia = %s")
        params.append(materia)
    if area:
        filtros.append("(q.materia = any((select materias from areas where id = %s)::text[]) or m.comum)")
        params.append(area)
    if excluir:
        ids = [i for i in excluir.split(",") if i][:500]
        filtros.append("not (q.id = any(%s))")
        params.append(ids)
    where = ("where " + " and ".join(filtros)) if filtros else ""
    campos = """q.id, q.materia, m.nome as materia_nome, q.enunciado, q.alternativas, q.fonte, q.origem,
                t.titulo as texto_titulo, t.texto as texto_base, t.fonte as texto_fonte"""
    origem = """from questoes q join materias m on m.id = q.materia
                left join textos_base t on t.codigo = q.texto"""
    if em_lotes:
        ponto = inicio if inicio is not None else pagina * limite
        linhas = consulta(
            f"""select * from (
                    select {campos}, row_number() over (partition by q.materia order by md5(q.id || %s)) as rn
                    {origem} {where}
                ) x order by x.rn, md5(x.materia || %s), x.id limit %s offset %s""",
            (semente, *params, semente, limite, ponto),
        )
        for linha in linhas:
            linha.pop("rn", None)
    else:
        linhas = consulta(
            f"""select {campos} {origem} {where} order by random() limit %s""",
            (*params, limite),
        )
    total = consulta(
        f"select count(*) as n from questoes q join materias m on m.id = q.materia {where}", params
    )[0]["n"]
    return {"total": total, "questoes": linhas}


class Resposta(BaseModel):
    resposta: str


@app.post("/api/questoes/{qid}/responder")
def responder(qid: str, corpo: Resposta, request: Request):
    exigir_login_se_ativo(request)
    linhas = consulta("select correta, comentario, alternativas from questoes where id = %s", (qid,))
    if not linhas:
        raise HTTPException(404, "Questão não encontrada")
    q = linhas[0]
    letra = corpo.resposta.strip().upper()[:1]
    if letra not in q["alternativas"]:
        raise HTTPException(400, "Alternativa inválida")
    return {"acertou": letra == q["correta"].strip(), "correta": q["correta"].strip(), "comentario": q["comentario"]}


# ---------- ALUNOS (login Ensino Plus via Supabase) ----------
def _config_supabase():
    url, chave = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_ANON_KEY")
    if url and chave:
        return url.rstrip("/"), chave
    # No PC: lê do config.js da página (chave pública).
    import re
    arq = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.js")
    txt = open(arq, encoding="utf-8").read()
    url = re.search(r'SUPABASE_URL\s*=\s*"([^"]+)"', txt).group(1)
    chave = re.search(r'SUPABASE_ANON_KEY\s*=\s*"([^"]+)"', txt).group(1)
    return url.rstrip("/"), chave


SUPABASE_URL, SUPABASE_ANON_KEY = _config_supabase()
_cache_tokens: dict[str, tuple[float, dict]] = {}


def usuario_do_token(request: Request) -> dict:
    """Confere o token de login com o Supabase e devolve o usuário."""
    import json
    import urllib.error
    import urllib.request

    cab = request.headers.get("authorization", "")
    if not cab.lower().startswith("bearer "):
        raise HTTPException(401, "Faça login")
    token = cab[7:].strip()
    agora = time.time()
    if token in _cache_tokens and agora - _cache_tokens[token][0] < 300:
        return _cache_tokens[token][1]
    req = urllib.request.Request(
        SUPABASE_URL + "/auth/v1/user", headers={"apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + token}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            u = json.load(r)
    except urllib.error.HTTPError:
        raise HTTPException(401, "Login expirado. Entre de novo.")
    if len(_cache_tokens) > 5000:
        _cache_tokens.clear()
    _cache_tokens[token] = (agora, u)
    return u


def expirar_planos():
    """Plano mensal/anual vencido volta para gratuito (a validade vale até o fim do dia informado)."""
    consulta("""update alunos set plano = 'gratuito' where plano in ('mensal', 'anual') and plano_validade is not null
                and plano_validade < (now() at time zone 'America/Fortaleza')::date returning id""")


def aplicar_pre_cadastro(aid, email):
    """Se um administrador cadastrou este e-mail antes, aplica os dados dele no primeiro acesso."""
    pre = consulta("delete from alunos_pre where email = lower(%s) returning *", (email or "",))
    if pre:
        p = pre[0]
        consulta("""update alunos set plano = %s, plano_validade = %s, origem = %s, observacao = %s,
                    nome = coalesce(%s, nome), whatsapp = coalesce(%s, whatsapp), cidade = coalesce(%s, cidade),
                    uf = coalesce(%s, uf), concurso_alvo = coalesce(%s, concurso_alvo) where id = %s returning id""",
                 (p["plano"], p["plano_validade"], p["origem"], p["observacao"], p["nome"], p["whatsapp"], p["cidade"],
                  p["uf"], p["concurso_alvo"], aid))


@app.post("/api/alunos/entrar")
def aluno_entrar(request: Request):
    """Registra (ou atualiza) o aluno deste projeto no primeiro acesso de cada sessão."""
    u = usuario_do_token(request)
    expirar_planos()
    meta = u.get("user_metadata") or {}
    nome = meta.get("full_name") or meta.get("name")
    linha = consulta(
        """insert into alunos(id, email, nome) values(%s, %s, %s)
           on conflict(id) do update set email = excluded.email, nome = coalesce(alunos.nome, excluded.nome),
             ultimo_acesso = now(), acessos = alunos.acessos + 1
           returning id, email, nome, plano, primeiro_acesso, acessos""",
        (u["id"], u.get("email"), nome),
    )[0]
    aplicar_pre_cadastro(u["id"], u.get("email"))
    linha = consulta("select id, email, nome, plano, plano_validade, primeiro_acesso, acessos from alunos where id = %s", (u["id"],))[0]
    # Convite de administrador pendente para este e-mail: vira admin agora.
    if consulta("delete from admin_convites where email = lower(%s) returning email", (u.get("email") or "",)):
        consulta("insert into admins(id) values(%s) on conflict do nothing returning id", (u["id"],))
    return linha


@app.get("/api/flashcards")
def flashcards(request: Request, materia: str | None = None, area: str | None = None):
    exigir_login_se_ativo(request)
    filtros, params = [], []
    if materia:
        filtros.append("f.materia = %s")
        params.append(materia)
    if area:
        filtros.append("(f.materia = any((select materias from areas where id = %s)::text[]) or m.comum)")
        params.append(area)
    where = ("where " + " and ".join(filtros)) if filtros else ""
    return consulta(
        f"select f.id, f.materia, f.frente, f.verso from flashcards f join materias m on m.id = f.materia {where} order by f.id",
        params,
    )


# Área administrativa (admin.py)
from admin import rota as _rota_admin  # noqa: E402

app.include_router(_rota_admin)

# Perfil do aluno (perfil.py)
from perfil import rota as _rota_perfil  # noqa: E402

app.include_router(_rota_perfil)


# Progresso do aluno (progresso.py) e textos editáveis da página (conteudo.py)
from progresso import rota as _rota_progresso  # noqa: E402
from conteudo import rota as _rota_conteudo  # noqa: E402

app.include_router(_rota_progresso)
app.include_router(_rota_conteudo)

# Importação de questões da QAPI (qapi.py). As colunas novas (texto, origem) são criadas na partida.
from qapi import rota as _rota_qapi, preparar_tabelas as _preparar_qapi  # noqa: E402

app.include_router(_rota_qapi)
try:
    _preparar_qapi()
except Exception as _e:  # dois processos ligando juntos podem colidir; o outro termina o serviço
    print("Aviso: tabelas da QAPI não preparadas agora:", _e)


# ---------- Site (página dos alunos e administração) servido pela própria API ----------
if SITE_DIR and os.path.isdir(SITE_DIR):
    import json as _json

    from fastapi.staticfiles import StaticFiles

    # config.js é gerado na partida com a chave PÚBLICA do Supabase (nunca vai para o git).
    with open(os.path.join(SITE_DIR, "config.js"), "w", encoding="utf-8") as _f:
        _f.write("window.SUPABASE_URL = %s;\nwindow.SUPABASE_ANON_KEY = %s;\n" % (_json.dumps(SUPABASE_URL), _json.dumps(SUPABASE_ANON_KEY)))

    @app.middleware("http")
    async def cabecalhos_de_seguranca(request: Request, call_next):
        resposta = await call_next(request)
        resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
        resposta.headers.setdefault("X-Frame-Options", "DENY")
        resposta.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return resposta

    app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")

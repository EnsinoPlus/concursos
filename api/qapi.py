"""Importação de questões da QAPI (https://qapi.otunac.com) para o banco `concursos`.

Os termos da QAPI permitem importar para banco próprio, com a atribuição
"Questões fornecidas por QAPI" visível ao aluno (a página mostra isso em cada questão importada).
Cada requisição à QAPI custa 1 cota (R$ 0,01) e devolve no máximo 10 questões.

Configuração: variável de ambiente QAPI_KEY (chave da conta QAPI). Nunca coloque a chave no código.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from admin import _slug, exigir_admin, registrar
from main import consulta, pool

rota = APIRouter(prefix="/api/admin/qapi")
BASE = "https://qapi.otunac.com/api"
FONTE = "QAPI"

# Matérias trabalhistas sugeridas na tela de importação (nome exato na QAPI).
SUGESTOES = ["Direito do Trabalho", "Direito Processual do Trabalho", "Direito Previdenciário",
             "Segurança e Saúde no Trabalho", "Legislação Trabalhista"]

_tabelas_prontas = False


def preparar_tabelas():
    """Cria o que a importação precisa. Pode rodar várias vezes sem efeito colateral."""
    global _tabelas_prontas
    if _tabelas_prontas:
        return
    with pool.connection() as c:
        c.execute("alter table questoes add column if not exists texto text")
        c.execute("alter table questoes add column if not exists origem jsonb")
        c.execute("""create table if not exists textos_base(
            codigo text primary key, titulo text, texto text not null, fonte text,
            criado_em timestamptz not null default now())""")
        c.execute("""create table if not exists qapi_importacoes(
            chave text primary key, proxima_pagina integer not null default 1, paginas integer,
            total integer, atualizado_em timestamptz not null default now())""")
    _tabelas_prontas = True


def _chave() -> str:
    k = os.environ.get("QAPI_KEY", "").strip()
    if not k:
        raise HTTPException(503, "A chave da QAPI não está configurada no servidor (variável QAPI_KEY).")
    return k


def _get(caminho: str, **params) -> dict:
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    req = urllib.request.Request(f"{BASE}/{caminho}?{q}", headers={"Q-Api-Key": _chave(), "User-Agent": "ensinoplus-concursos"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        msg = {401: "Chave da QAPI inválida.", 402: "Sem cotas na QAPI. Faça uma recarga no painel da QAPI.",
               403: "Chave da QAPI suspensa.", 404: "Não encontrado na QAPI."}.get(e.code, f"Erro da QAPI ({e.code}).")
        raise HTTPException(502 if e.code >= 500 else 400, msg)
    except (urllib.error.URLError, TimeoutError):
        raise HTTPException(502, "Não foi possível falar com a QAPI agora. Tente de novo em instantes.")


def converter(q: dict) -> dict | None:
    """Transforma uma questão da QAPI no formato do banco. Devolve None se estiver incompleta."""
    enun = (q.get("enunciado") or "").strip()
    gab = (q.get("gabarito") or "").strip().upper()
    if not enun or not q.get("qCode"):
        return None
    if q.get("tipo") == "certo_errado" or gab in ("CERTO", "ERRADO"):
        alts, correta = {"C": "Certo", "E": "Errado"}, gab[:1]
    else:
        alts = {l: str(q.get("opcao" + l)).strip() for l in "ABCDE" if str(q.get("opcao" + l) or "").strip()}
        correta = gab[:1]
    if len(alts) < 2 or correta not in alts:
        return None
    origem = {
        "qcode": q["qCode"],
        "banca": q.get("siglaBanca") or q.get("banca"),
        "orgao": q.get("siglaOrgao") or q.get("orgao"),
        "cargo": q.get("cargo"),
        "ano": str(q.get("ano") or "") or None,
        "assunto": q.get("assunto"),
    }
    return {"id": "qapi-" + q["qCode"], "enunciado": enun, "alternativas": alts, "correta": correta,
            "comentario": (q.get("comentario") or "").strip(), "texto": (q.get("texto") or "").strip() or None,
            "origem": {k: v for k, v in origem.items() if v}}


class Pedido(BaseModel):
    materia_qapi: str = Field(min_length=2, max_length=120)
    materia: str = ""          # id da matéria no nosso banco; vazio = cria uma com o nome da QAPI
    banca: str = ""
    ano: str = ""
    paginas: int = Field(5, ge=1, le=60)  # cada página = 1 cota = até 10 questões


@rota.get("/sugestoes")
def sugestoes(request: Request):
    exigir_admin(request)
    return {"materias": SUGESTOES, "configurada": bool(os.environ.get("QAPI_KEY", "").strip())}


@rota.post("/importar")
def importar(p: Pedido, request: Request):
    adm = exigir_admin(request)
    preparar_tabelas()
    nome = p.materia_qapi.strip()
    filtros = {"materia": nome, "banca": p.banca.strip(), "ano": p.ano.strip()}
    chave = json.dumps(filtros, ensure_ascii=False, sort_keys=True)

    # Matéria de destino (cria se não existir).
    mid = p.materia.strip()
    if mid:
        if not consulta("select 1 from materias where id = %s", (mid,)):
            raise HTTPException(400, "Matéria de destino não encontrada")
    else:
        achada = consulta("select id from materias where lower(nome) = lower(%s)", (nome,))
        if achada:
            mid = achada[0]["id"]
        else:
            mid = _slug(nome, "materias")
            consulta("insert into materias(id, nome, comum, topicos) values(%s,%s,false,%s) returning id", (mid, nome, Jsonb([])))
            registrar(adm, "criar_materia", mid, {"origem": "importação QAPI"})

    cursor = consulta("select proxima_pagina from qapi_importacoes where chave = %s", (chave,))
    pagina = cursor[0]["proxima_pagina"] if cursor else 1
    existentes = {r["id"] for r in consulta("select id from questoes where id like %s", ("qapi-%",))}
    textos_salvos = {r["codigo"] for r in consulta("select codigo from textos_base")}
    gravadas = repetidas = ignoradas = cotas = 0
    total = paginas_total = None

    for _ in range(p.paginas):
        d = _get("questoes", page=pagina, size=10, **filtros)
        cotas += 1
        total, paginas_total = d.get("total", 0), d.get("pages", 0)
        lista = d.get("questoes") or []
        if not lista:
            break
        novas = []
        for bruto in lista:
            q = converter(bruto)
            if not q:
                ignoradas += 1
                continue
            if q["id"] in existentes:
                repetidas += 1
                continue
            if q["texto"] and q["texto"] not in textos_salvos:
                try:
                    t = _get("textos/" + urllib.parse.quote(q["texto"]))
                    cotas += 1
                    consulta("""insert into textos_base(codigo, titulo, texto, fonte) values(%s,%s,%s,%s)
                                on conflict (codigo) do nothing returning codigo""",
                             (q["texto"], t.get("titulo"), t.get("texto") or "", t.get("fonte")))
                    textos_salvos.add(q["texto"])
                except HTTPException:
                    ignoradas += 1  # sem o texto base a questão não faz sentido
                    continue
            novas.append((q["id"], mid, q["enunciado"], Jsonb(q["alternativas"]), q["correta"], q["comentario"],
                          FONTE, False, q["texto"], Jsonb(q["origem"])))
            existentes.add(q["id"])
        if novas:
            with pool.connection() as c:
                c.cursor().executemany(
                    """insert into questoes(id, materia, enunciado, alternativas, correta, comentario, fonte, revisada, texto, origem)
                       values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (id) do nothing""", novas)
            gravadas += len(novas)
        pagina += 1
        if paginas_total and pagina > paginas_total:
            break

    consulta("""insert into qapi_importacoes(chave, proxima_pagina, paginas, total, atualizado_em)
                values(%s,%s,%s,%s,now())
                on conflict (chave) do update set proxima_pagina = excluded.proxima_pagina, paginas = excluded.paginas,
                    total = excluded.total, atualizado_em = now() returning chave""",
             (chave, pagina, paginas_total, total))
    registrar(adm, "importar_qapi", nome, {"filtros": filtros, "materia": mid, "gravadas": gravadas,
                                           "repetidas": repetidas, "ignoradas": ignoradas, "cotas": cotas})
    restantes = max(0, (paginas_total or 0) - pagina + 1)
    return {"materia": mid, "gravadas": gravadas, "repetidas": repetidas, "ignoradas": ignoradas, "cotas": cotas,
            "total_na_qapi": total, "paginas_restantes": restantes}


@rota.get("/importacoes")
def importacoes(request: Request):
    exigir_admin(request)
    preparar_tabelas()
    return consulta("select chave, proxima_pagina, paginas, total, atualizado_em from qapi_importacoes order by atualizado_em desc")

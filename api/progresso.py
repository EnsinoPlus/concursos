"""Progresso do aluno guardado no banco — acompanha o aluno em qualquer aparelho.

O navegador envia o progresso inteiro (respostas, flashcards, edital, redação...) e a
carga `_t` (hora da última mudança). Se outro aparelho já gravou algo mais novo, a API
responde 409 com os dados atuais para o navegador adotar."""
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from main import consulta
from perfil import _aluno

rota = APIRouter(prefix="/api/progresso")
CHAVES = {"areaId": str, "respostas": dict, "dias": list, "srs": dict, "cardsCriados": list,
          "edital": dict, "editalAbertos": dict, "redacao": dict}
MAX_BYTES = 600_000


def limpar(d: dict) -> dict:
    """Aceita só os campos conhecidos, com o tipo certo."""
    saida = {}
    for chave, tipo in CHAVES.items():
        v = d.get(chave)
        if v is None:
            continue
        if not isinstance(v, tipo):
            raise HTTPException(400, f"Campo inválido: {chave}")
        saida[chave] = v
    t = d.get("_t", 0)
    if isinstance(t, bool) or not isinstance(t, (int, float)):
        raise HTTPException(400, "Campo inválido: _t")
    saida["_t"] = int(t)
    return saida


@rota.get("")
def ver(request: Request):
    u = _aluno(request)
    linha = consulta("select dados from progresso where aluno_id = %s", (u["id"],))
    return {"dados": linha[0]["dados"] if linha else None}


class Carga(BaseModel):
    dados: dict


@rota.put("")
def gravar(carga: Carga, request: Request):
    u = _aluno(request)
    novo = limpar(carga.dados)
    if len(json.dumps(novo)) > MAX_BYTES:
        raise HTTPException(400, "Progresso muito grande")
    atual = consulta("select dados from progresso where aluno_id = %s", (u["id"],))
    if atual and int(atual[0]["dados"].get("_t", 0)) > novo["_t"]:
        return JSONResponse(status_code=409, content={"dados": atual[0]["dados"]})
    consulta("""insert into progresso(aluno_id, dados) values(%s, %s)
                on conflict(aluno_id) do update set dados = excluded.dados, atualizado = now() returning aluno_id""",
             (u["id"], Jsonb(novo)))
    return {"ok": True}

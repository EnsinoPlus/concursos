"""Perfil do aluno — cada aluno vê e edita só as próprias informações e a foto."""
import base64
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from main import aplicar_pre_cadastro, consulta, usuario_do_token

rota = APIRouter(prefix="/api/perfil")
UFS = {"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
       "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"}
FOTO_MAX = 300 * 1024  # a página reduz a foto antes de enviar


def _aluno(request: Request) -> dict:
    u = usuario_do_token(request)
    if not consulta("select 1 from alunos where id = %s", (u["id"],)):
        meta = u.get("user_metadata") or {}
        consulta("insert into alunos(id, email, nome) values(%s,%s,%s) on conflict(id) do nothing returning id",
                 (u["id"], u.get("email"), meta.get("full_name") or meta.get("name")))
        aplicar_pre_cadastro(u["id"], u.get("email"))
    return u


def _perfil(aid: str) -> dict:
    p = consulta("""select id, email, nome, whatsapp, cidade, uf, concurso_alvo, plano, plano_validade, primeiro_acesso,
                           foto, foto_tipo, perfil_atualizado from alunos where id = %s""", (aid,))[0]
    foto = p.pop("foto")
    tipo = p.pop("foto_tipo")
    p["foto"] = f"data:{tipo};base64,{base64.b64encode(foto).decode()}" if foto else None
    return p


@rota.get("")
def ver(request: Request):
    return _perfil(_aluno(request)["id"])


class PerfilDados(BaseModel):
    nome: str
    whatsapp: str = ""
    cidade: str = ""
    uf: str = ""
    concurso_alvo: str = ""


@rota.put("")
def editar(corpo: PerfilDados, request: Request):
    u = _aluno(request)
    nome = corpo.nome.strip()
    if not 2 <= len(nome) <= 120:
        raise HTTPException(400, "Informe seu nome (2 a 120 caracteres)")
    zap = re.sub(r"\D", "", corpo.whatsapp)
    if zap and not 10 <= len(zap) <= 13:
        raise HTTPException(400, "WhatsApp inválido. Use DDD + número")
    uf = corpo.uf.strip().upper()
    if uf and uf not in UFS:
        raise HTTPException(400, "Estado inválido")
    consulta("""update alunos set nome=%s, whatsapp=%s, cidade=%s, uf=%s, concurso_alvo=%s, perfil_atualizado=now()
                where id=%s returning id""",
             (nome, zap or None, corpo.cidade.strip()[:80] or None, uf or None, corpo.concurso_alvo.strip()[:120] or None,
              u["id"]))
    return _perfil(u["id"])


class FotoDados(BaseModel):
    imagem: str  # data URL (image/jpeg, image/png ou image/webp)


@rota.put("/foto")
def trocar_foto(corpo: FotoDados, request: Request):
    u = _aluno(request)
    m = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", corpo.imagem.strip())
    if not m:
        raise HTTPException(400, "Envie uma imagem JPG, PNG ou WEBP")
    dados = base64.b64decode(m.group(2))
    if len(dados) > FOTO_MAX:
        raise HTTPException(400, "Imagem muito grande")
    assinaturas = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG", "image/webp": b"RIFF"}
    if not dados.startswith(assinaturas[m.group(1)]):
        raise HTTPException(400, "Arquivo de imagem inválido")
    consulta("update alunos set foto=%s, foto_tipo=%s, perfil_atualizado=now() where id=%s returning id",
             (dados, m.group(1), u["id"]))
    return _perfil(u["id"])


@rota.delete("/foto")
def remover_foto(request: Request):
    u = _aluno(request)
    consulta("update alunos set foto=null, foto_tipo=null, perfil_atualizado=now() where id=%s returning id", (u["id"],))
    return _perfil(u["id"])

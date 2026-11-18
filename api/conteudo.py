"""Textos da página que a administração pode editar (módulos, guias, rodapé, critérios, pegadinhas)."""
import re

from fastapi import APIRouter, HTTPException

from main import consulta

rota = APIRouter(prefix="/api/conteudo")

# Termo permitido nas listas de pegadinhas: letras, espaços, [xy] (alternativas de letra) e ? (letra opcional).
TERMO = re.compile(r"(?:[A-Za-zÀ-ÿ ]|\[[a-zà-ÿ]{2,4}\]|\?)+")


@rota.get("")
def ver():
    return {r["chave"]: r["valor"] for r in consulta("select chave, valor from conteudo")}


def _texto(v, minimo, maximo, rotulo):
    if not isinstance(v, str):
        raise HTTPException(400, f"{rotulo}: texto inválido")
    v = v.strip()
    if not minimo <= len(v) <= maximo:
        raise HTTPException(400, f"{rotulo}: use entre {minimo} e {maximo} caracteres")
    return v


def _lista(v, minimo, maximo, tam, rotulo):
    if not isinstance(v, list):
        raise HTTPException(400, f"{rotulo}: lista inválida")
    itens = [_texto(x, 1, tam, rotulo) for x in v if isinstance(x, str) and x.strip()]
    if not minimo <= len(itens) <= maximo:
        raise HTTPException(400, f"{rotulo}: informe entre {minimo} e {maximo} itens")
    return itens


def validar(chave: str, valor, atual):
    """Confere e devolve o valor pronto para gravar."""
    if chave == "rodape":
        return _texto(valor, 1, 200, "Rodapé")
    if chave == "criterios_redacao":
        return _lista(valor, 1, 12, 200, "Critérios")
    if chave in ("modulos", "guias"):
        if not isinstance(valor, dict):
            raise HTTPException(400, "Formato inválido")
        saida = dict(atual or {})
        for k, v in valor.items():
            if k not in saida:
                raise HTTPException(400, f"Item desconhecido: {k}")
            if chave == "modulos":
                if not isinstance(v, dict):
                    raise HTTPException(400, "Formato inválido")
                saida[k] = {"nome": _texto(v.get("nome"), 1, 60, "Nome do módulo"),
                            "desc": _texto(v.get("desc"), 1, 300, "Descrição do módulo")}
            else:
                saida[k] = _lista(v, 1, 8, 200, "Guia")
        return saida
    if chave == "planos":
        if not isinstance(valor, dict):
            raise HTTPException(400, "Formato inválido")
        saida = dict(atual or {})

        def preco(v, rotulo):
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not 1 <= v <= 9999:
                raise HTTPException(400, f"{rotulo}: informe um valor entre R$ 1,00 e R$ 9.999,00")
            return round(float(v), 2)

        mensal = preco((valor.get("mensal") or {}).get("preco"), "Preço mensal")
        anual = preco((valor.get("anual") or {}).get("preco"), "Preço anual")
        if anual >= mensal * 12:
            raise HTTPException(400, "O plano anual precisa custar menos que 12 meses do mensal")
        parcelas = (valor.get("anual") or {}).get("parcelas", 12)
        if isinstance(parcelas, bool) or not isinstance(parcelas, int) or not 1 <= parcelas <= 12:
            raise HTTPException(400, "Parcelas do anual: de 1 a 12")
        saida["mensal"] = {"preco": mensal}
        saida["anual"] = {"preco": anual, "parcelas": parcelas}
        if "beneficios" in valor:
            saida["beneficios"] = _lista(valor["beneficios"], 1, 12, 120, "Itens incluídos")
        return saida
    if chave == "pegadinhas":
        if not isinstance(valor, dict):
            raise HTTPException(400, "Formato inválido")
        saida = {}
        for grupo in ("alerta", "excecao"):
            termos = _lista(valor.get(grupo), 1, 100, 40, "Palavras")
            for t in termos:
                if not TERMO.fullmatch(t) or "??" in t:
                    raise HTTPException(400, f"Termo não permitido: {t}. Use só letras, espaços, [oa] e ?.")
            saida[grupo] = termos
        return saida
    raise HTTPException(404, "Texto desconhecido")

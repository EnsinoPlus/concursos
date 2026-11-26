"""Gera flashcards a partir das questões do banco usando o Claude (API da Anthropic).

Para cada questão o Claude escreve um cartão de revisão: uma pergunta curta na frente e a resposta com o
fundamento no verso. Questões que não rendem um bom cartão são puladas. Cada cartão guarda o código da
questão de origem (coluna flashcards.questao), então rodar de novo só gera para questões novas.

Precisa das variáveis DATABASE_URL e ANTHROPIC_API_KEY. No PC:
    D:\\almir\\ferramentas\\pgvenv\\Scripts\\python db\\gerar_flashcards_ia.py teste 5
    ... enviar          (manda todas as questões sem cartão num lote; metade do preço, demora até 1 hora)
    ... buscar          (grava os cartões do lote e apaga os 38 gerados pela regra antiga)

Sem gastar com a API (os cartões são escritos no Claude Code, por partes):
    ... exportar <materia> <arquivo.json> [limite]   (questões sem cartão, para ler)
    ... gravar <cartoes.json>                        (grava os cartões; {"id", "pular": true} marca questão sem cartão)
    ... apagar-antigos                               (apaga os 38 da regra antiga)
"""
import html
import json
import os
import sys

import psycopg
from psycopg.rows import dict_row

MODELO = "claude-opus-5-5"
ARQ_LOTE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ultimo_lote_flashcards.txt")
# Marca dos cartões feitos pela regra antiga (frente = enunciado), que estes substituem.
MARCA_REGRA_ANTIGA = "Baseado em questão fornecida por QAPI"

INSTRUCOES = """Você escreve flashcards de revisão para alunos de concursos públicos no Brasil.

Recebe uma questão de prova já resolvida (enunciado, alternativas, gabarito e explicação) e transforma o
conhecimento que ela cobra em UM flashcard:
- "frente": uma pergunta curta e direta (até 200 caracteres), que faça sentido sozinha, sem depender das
  alternativas nem de "assinale a correta". Pergunte o conceito, a regra, o prazo ou a exceção que a questão cobra.
- "resposta": a resposta direta e curta (até 200 caracteres).
- "fundamento": de onde vem a resposta (artigo de lei, súmula, conceito), em 1 ou 2 frases (até 350
  caracteres). Use só o que está na questão e na explicação ou o que é certo e estável; não invente número de
  artigo nem de súmula. Se não souber a fonte com segurança, explique a regra sem citar número.
- "util": false quando a questão não rende um bom cartão (depende de um texto ou gráfico que não está aqui,
  é só interpretação de texto, cálculo sem regra a memorizar, o gabarito parece errado ou a questão está confusa).
  Nesse caso deixe os outros campos vazios.

Escreva em português do Brasil, linguagem simples. Ignore anotações internas de cadastro que apareçam na
explicação (por exemplo, menções a "forcarCriacao" ou a números de outras questões)."""

ESQUEMA = {
    "type": "object",
    "properties": {
        "util": {"type": "boolean"},
        "frente": {"type": "string"},
        "resposta": {"type": "string"},
        "fundamento": {"type": "string"},
    },
    "required": ["util", "frente", "resposta", "fundamento"],
    "additionalProperties": False,
}


def conectar():
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)


def preparar(c):
    c.execute("alter table flashcards add column if not exists questao text")
    c.execute("create index if not exists flashcards_questao on flashcards(questao)")
    # Questões que não rendem um bom cartão (avaliadas uma vez, não voltam na próxima rodada).
    c.execute("create table if not exists flashcards_pulados(questao text primary key, criado_em timestamptz not null default now())")
    c.commit()


def questoes_sem_cartao(c, limite=None):
    sql = """select q.id, q.materia, m.nome as materia_nome, q.enunciado, q.alternativas, q.correta, q.comentario,
                    q.fonte, q.origem, t.texto as texto_base
             from questoes q join materias m on m.id = q.materia left join textos_base t on t.codigo = q.texto
             where not exists (select 1 from flashcards f where f.questao = q.id)
               and not exists (select 1 from flashcards_pulados p where p.questao = q.id)
             order by q.materia, q.id"""
    if limite:
        sql += f" limit {int(limite)}"
    return c.execute(sql).fetchall()


def montar_pedido(q):
    alts = "\n".join(f"{k}) {v}" for k, v in sorted(q["alternativas"].items()))
    partes = [f"Matéria: {q['materia_nome']}"]
    if q["texto_base"]:
        partes.append("Texto de apoio:\n" + q["texto_base"][:3000])
    partes += [f"Enunciado:\n{q['enunciado']}", f"Alternativas:\n{alts}", f"Gabarito: {q['correta'].strip()}",
               f"Explicação:\n{q['comentario'] or '(sem explicação)'}"]
    return {
        "model": MODELO,
        "max_tokens": 4000,
        "system": INSTRUCOES,
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": ESQUEMA}},
        "messages": [{"role": "user", "content": "\n\n".join(partes)}],
    }


def ler_cartao(msg):
    """Devolve o dicionário do cartão, ou None se o Claude recusou, cortou ou achou a questão inútil."""
    if msg.stop_reason != "end_turn":
        return None
    texto = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        d = json.loads(texto)
    except json.JSONDecodeError:
        return None
    if not d.get("util") or not d.get("frente", "").strip() or not d.get("resposta", "").strip():
        return None
    return d


def verso_html(d, q):
    """O verso é mostrado como HTML na página: tudo o que veio do Claude é escapado."""
    verso = f"<strong>{html.escape(d['resposta'].strip())}</strong>"
    if d.get("fundamento", "").strip():
        verso += f"<br><br>{html.escape(d['fundamento'].strip())}"
    if q["fonte"] == "QAPI":
        o = q["origem"] or {}
        prova = " ".join(str(x) for x in (o.get("banca"), o.get("ano")) if x)
        verso += f"<br><br><small>Feito a partir de questão fornecida por QAPI{f' ({html.escape(prova)})' if prova else ''}.</small>"
    return verso


def teste(n):
    import anthropic

    cliente = anthropic.Anthropic()
    with conectar() as c:
        preparar(c)
        qs = questoes_sem_cartao(c, n)
    entrada = saida = 0
    for q in qs:
        msg = cliente.messages.create(**montar_pedido(q))
        entrada += msg.usage.input_tokens
        saida += msg.usage.output_tokens
        d = ler_cartao(msg)
        print(f"\n=== {q['id']} ({q['materia_nome']})")
        print("PULADA" if not d else f"FRENTE: {d['frente']}\nVERSO: {d['resposta']}\n       {d['fundamento']}")
    print(f"\nTokens: {entrada} de entrada, {saida} de saída em {len(qs)} questões")
    with conectar() as c:
        total = len(questoes_sem_cartao(c))
    if qs:
        # Preço do Opus 5.5: US$ 4 / US$ 20 por milhão; o lote custa metade.
        por_q = (entrada * 4 + saida * 20) / 1e6 / len(qs)
        print(f"Estimativa para as {total} questões sem cartão, em lote: US$ {por_q * total / 2:.2f}")


def enviar():
    import anthropic
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    cliente = anthropic.Anthropic()
    with conectar() as c:
        preparar(c)
        qs = questoes_sem_cartao(c)
    if not qs:
        print("Todas as questões já têm cartão.")
        return
    lote = cliente.messages.batches.create(requests=[
        Request(custom_id=f"q{i}", params=MessageCreateParamsNonStreaming(**montar_pedido(q))) for i, q in enumerate(qs)
    ])
    with open(ARQ_LOTE, "w", encoding="utf-8") as f:
        json.dump({"lote": lote.id, "questoes": [q["id"] for q in qs]}, f)
    print(f"Lote {lote.id} enviado com {len(qs)} questões. Depois rode: buscar")


def buscar():
    import anthropic

    cliente = anthropic.Anthropic()
    with open(ARQ_LOTE, encoding="utf-8") as f:
        info = json.load(f)
    lote = cliente.messages.batches.retrieve(info["lote"])
    if lote.processing_status != "ended":
        n = lote.request_counts
        print(f"Ainda processando: {n.processing} na fila, {n.succeeded} prontas.")
        return
    ids = info["questoes"]
    with conectar() as c:
        qs = {q["id"]: q for q in c.execute(
            """select q.id, q.materia, q.fonte, q.origem from questoes q where q.id = any(%s)""", (ids,)).fetchall()}
        novos = pulados = erros = 0
        entrada = saida = 0
        for r in cliente.messages.batches.results(info["lote"]):
            qid = ids[int(r.custom_id[1:])]
            if r.result.type != "succeeded" or qid not in qs:
                erros += 1
                continue
            msg = r.result.message
            entrada += msg.usage.input_tokens
            saida += msg.usage.output_tokens
            d = ler_cartao(msg)
            if not d:
                pulados += 1
                continue
            q = qs[qid]
            c.execute("""insert into flashcards(materia, frente, verso, questao)
                         select %s, %s, %s, %s where not exists (select 1 from flashcards where questao = %s)""",
                      (q["materia"], d["frente"].strip()[:300], verso_html(d, q), qid, qid))
            novos += 1
        antigos = c.execute("delete from flashcards where questao is null and verso like %s",
                            (f"%{MARCA_REGRA_ANTIGA}%",)).rowcount
        c.commit()
        total = c.execute("select count(*) n from flashcards").fetchone()["n"]
    custo = (entrada * 4 + saida * 20) / 1e6 / 2
    print(f"{novos} cartões gravados, {pulados} questões puladas, {erros} com erro.")
    print(f"{antigos} cartões da regra antiga apagados. Total agora: {total}. Custo do lote: US$ {custo:.2f}")


# ---------- Sem API: os cartões são escritos no Claude Code (plano do Claude), em partes ----------
def exportar(materia, arquivo, limite=100):
    """Grava num JSON as questões da matéria que ainda não têm cartão (explicação encurtada)."""
    with conectar() as c:
        preparar(c)
        qs = [q for q in questoes_sem_cartao(c) if q["materia"] == materia][: int(limite)]
    saida = [{"id": q["id"], "enunciado": q["enunciado"][:1500],
              "alternativas": q["alternativas"], "gabarito": q["correta"].strip(),
              "explicacao": (q["comentario"] or "")[:900], "tem_texto_base": bool(q["texto_base"])} for q in qs]
    with open(arquivo, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=0)
    print(f"{len(saida)} questões exportadas para {arquivo}")


def gravar(arquivo):
    """Lê [{"id", "frente", "resposta", "fundamento"}] e grava os cartões (pula questão que já tem cartão)."""
    with open(arquivo, encoding="utf-8") as f:
        cartoes = json.load(f)
    with conectar() as c:
        preparar(c)
        ids = [d["id"] for d in cartoes]
        qs = {q["id"]: q for q in c.execute(
            "select id, materia, fonte, origem from questoes where id = any(%s)", (ids,)).fetchall()}
        novos = pulados = 0
        for d in cartoes:
            q = qs.get(d["id"])
            if q and d.get("pular"):
                pulados += c.execute("insert into flashcards_pulados(questao) values(%s) on conflict do nothing",
                                     (d["id"],)).rowcount
                continue
            if not q or not d.get("frente", "").strip() or not d.get("resposta", "").strip():
                continue
            n = c.execute("""insert into flashcards(materia, frente, verso, questao)
                             select %s, %s, %s, %s where not exists (select 1 from flashcards where questao = %s)
                             on conflict (frente) do nothing""",
                          (q["materia"], d["frente"].strip()[:300], verso_html(d, q), d["id"], d["id"])).rowcount
            if not n:  # já existe cartão com a mesma pergunta: a questão fica coberta por ele
                c.execute("insert into flashcards_pulados(questao) values(%s) on conflict do nothing", (d["id"],))
                pulados += 1
            novos += n
        c.commit()
    print(f"{novos} cartões gravados e {pulados} questões puladas ({len(cartoes)} no arquivo).")


def apagar_regra_antiga():
    with conectar() as c:
        n = c.execute("delete from flashcards where questao is null and verso like %s",
                      (f"%{MARCA_REGRA_ANTIGA}%",)).rowcount
        c.commit()
    print(f"{n} cartões da regra antiga apagados.")


if __name__ == "__main__":
    acao = sys.argv[1] if len(sys.argv) > 1 else ""
    if acao == "teste":
        teste(int(sys.argv[2]) if len(sys.argv) > 2 else 5)
    elif acao == "enviar":
        enviar()
    elif acao == "buscar":
        buscar()
    elif acao == "exportar":
        exportar(sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
    elif acao == "gravar":
        gravar(sys.argv[2])
    elif acao == "apagar-antigos":
        apagar_regra_antiga()
    else:
        print(__doc__)

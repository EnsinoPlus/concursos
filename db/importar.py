# ATENCAO: este script RECRIA matérias, áreas, questões e flashcards a partir do dados.json
# e sobrescreve o que foi editado na administração. Use só para montar um banco novo.
import json, os, psycopg
from psycopg.types.json import Jsonb
url = os.environ['DATABASE_URL']  # URL do Postgres (qualquer banco do servidor; o script usa o banco `concursos`)
base=url.rsplit('/',1)[0]
with psycopg.connect(base+'/postgres',autocommit=True) as c:
    if not c.execute("select 1 from pg_database where datname='concursos'").fetchone():
        c.execute('create database concursos'); print('banco criado')
d=json.load(open('dados.json',encoding='utf-8'))  # gerado a partir do dados.js
with psycopg.connect(base+'/concursos') as c:
    c.execute("""
    create table if not exists materias(id text primary key, nome text not null, comum boolean not null default false, topicos jsonb not null default '[]');
    create table if not exists areas(id text primary key, nome text not null, icone text, cor text, descricao text, cargos jsonb not null default '[]', materias text[] not null default '{}');
    create table if not exists questoes(id text primary key, materia text not null references materias(id), enunciado text not null, alternativas jsonb not null, correta char(1) not null, comentario text, fonte text not null default 'Ensino Plus (autoral)', revisada boolean not null default false, criada_em timestamptz not null default now());
    create index if not exists questoes_materia_idx on questoes(materia);
    create table if not exists alunos(id uuid primary key, email text not null, nome text, plano text not null default 'gratuito', primeiro_acesso timestamptz not null default now(), ultimo_acesso timestamptz not null default now(), acessos integer not null default 1);
    create index if not exists alunos_email_idx on alunos(lower(email));
    alter table alunos add column if not exists whatsapp text;
    alter table alunos add column if not exists cidade text;
    alter table alunos add column if not exists uf char(2);
    alter table alunos add column if not exists concurso_alvo text;
    alter table alunos add column if not exists foto bytea;
    alter table alunos add column if not exists foto_tipo text;
    alter table alunos add column if not exists perfil_atualizado timestamptz;
    create table if not exists admins(id uuid primary key references alunos(id) on delete cascade, criado_em timestamptz not null default now());
    create table if not exists admin_convites(email text primary key, criado_por uuid, criado_em timestamptz not null default now());
    create table if not exists alunos_pre(email text primary key, nome text, plano text not null default 'gratuito', criado_por uuid, criado_em timestamptz not null default now());
    alter table alunos add column if not exists plano_validade date;
    alter table alunos add column if not exists origem text not null default 'manual';
    alter table alunos add column if not exists observacao text;
    alter table alunos_pre add column if not exists whatsapp text;
    alter table alunos_pre add column if not exists cidade text;
    alter table alunos_pre add column if not exists uf char(2);
    alter table alunos_pre add column if not exists concurso_alvo text;
    alter table alunos_pre add column if not exists plano_validade date;
    alter table alunos_pre add column if not exists origem text not null default 'manual';
    alter table alunos_pre add column if not exists observacao text;
    create table if not exists progresso(aluno_id uuid primary key references alunos(id) on delete cascade, dados jsonb not null, atualizado timestamptz not null default now());
    create table if not exists conteudo(chave text primary key, valor jsonb not null, atualizado timestamptz not null default now());
    create table if not exists admin_log(id bigserial primary key, admin_id uuid not null, acao text not null, alvo text, detalhe jsonb, criado_em timestamptz not null default now());
    create table if not exists flashcards(id serial primary key, materia text not null references materias(id), frente text not null unique, verso text not null, criada_em timestamptz not null default now());
    """)
    for k,m in d['M'].items():
        c.execute("insert into materias values(%s,%s,%s,%s) on conflict(id) do update set nome=excluded.nome,comum=excluded.comum,topicos=excluded.topicos",(k,m['nome'],bool(m.get('comum')),Jsonb(m.get('topicos',[]))))
    for a in d['A']:
        k=a['id']
        c.execute("insert into areas values(%s,%s,%s,%s,%s,%s,%s) on conflict(id) do update set nome=excluded.nome,icone=excluded.icone,cor=excluded.cor,descricao=excluded.descricao,cargos=excluded.cargos,materias=excluded.materias",(a.get('id',k),a['nome'],a.get('icone'),a.get('cor'),a.get('descricao'),Jsonb(a.get('cargos',[])),a.get('materias',[])))
    for q in d['Q']:
        c.execute("insert into questoes(id,materia,enunciado,alternativas,correta,comentario) values(%s,%s,%s,%s,%s,%s) on conflict(id) do update set materia=excluded.materia,enunciado=excluded.enunciado,alternativas=excluded.alternativas,correta=excluded.correta,comentario=excluded.comentario",(str(q['id']),q['materia'],q['enunciado'],Jsonb(q['alternativas']),q['correta'],q.get('comentario')))
    for f in d['F']:
        c.execute("insert into flashcards(materia,frente,verso) values(%s,%s,%s) on conflict(frente) do update set verso=excluded.verso,materia=excluded.materia",(f['materia'],f['frente'],f['verso']))
    pad = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'conteudo_padrao.json'), encoding='utf-8'))
    for k, v in pad.items():
        c.execute("insert into conteudo(chave, valor) values(%s,%s) on conflict do nothing", (k, Jsonb(v)))
    for t in ['materias','areas','questoes','flashcards','alunos']:
        print(t, c.execute(f'select count(*) from {t}').fetchone()[0])

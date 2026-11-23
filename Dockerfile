# Ensino Plus Concursos — um só serviço: a API (FastAPI) serve também a página dos alunos e a administração.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY api/requirements.txt api/requirements.txt
RUN pip install -r api/requirements.txt

COPY api/ api/
# Só estes arquivos são públicos. dados, scripts de banco e config.js local ficam de fora.
COPY index.html admin.html app.js auth.js perfil.js planos.js sync.js admin.js estilo.css fontes.css favicon.svg manifest.webmanifest icone-192.png icone-512.png apple-touch-icon.png site/
COPY fontes/ site/fontes/
COPY vendor/ site/vendor/

RUN useradd --create-home app && chown -R app /app/site
USER app

ENV SITE_DIR=/app/site
WORKDIR /app/api
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

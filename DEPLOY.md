# Publicar o Ensino Plus Concursos

A API e a página rodam num único serviço (uma imagem Docker, porta 8000). A API serve a página em `/` e a si mesma em `/api`, então não há CORS nem segundo servidor.

## Variáveis de ambiente do serviço

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Postgres apontando para o banco `concursos` (host interno do Easypanel) |
| `SUPABASE_URL` | URL do Supabase do login Ensino Plus (chave pública, a mesma dos outros apps) |
| `SUPABASE_ANON_KEY` | chave pública (anon) desse Supabase |
| `ADMIN_PRINCIPAL` | e-mail do administrador principal (sempre tem acesso e não pode ser removido). Sem esta variável não há administrador principal |
| `LIMITE_POR_MINUTO` | opcional; pedidos por minuto por IP (padrão 60) |

Este repositório é público: não coloque senhas, chaves nem endereços de infraestrutura no código. O `config.js` é gerado na partida a partir das variáveis acima.

## Passos

1. **Repositório:** o código está num repositório público da organização EnsinoPlus. O `config.js` e as credenciais ficam fora do git.
2. **Easypanel:** criar um serviço de aplicação a partir do repositório, usando o `Dockerfile` da raiz, porta 8000, com as variáveis acima.
3. **Domínio e HTTPS:** apontar o domínio para o serviço no Easypanel.
4. **Supabase (login):** em Authentication > URL Configuration, acrescentar o novo domínio em *Redirect URLs*. Sem isso, o login com Google e a recuperação de senha não voltam para a página. O Supabase é compartilhado com os outros apps: só acrescente, não troque a *Site URL*.
5. **Teste depois de publicar:** abrir o domínio, entrar com a conta, responder uma questão, abrir Perfil, Planos e `/admin.html`.

## Antes de vender

- Questões revisadas por um professor (hoje todas estão como "não revisadas").
- Resposta da QAPI e importação das questões, com a atribuição "Questões fornecidas por QAPI" visível na página.
- Ligação com o Asaas (cobrança, webhook e regra de atraso).
- O caderno carrega todas as questões de uma vez. Com milhares de questões, isso precisa virar carga aos poucos.
- O banco usa o usuário `postgres` (administrador). O recomendado é um usuário só do banco `concursos`.

## Why

O backend hoje é um scaffold `nest new` vazio — não há client de banco, validação de env, envelope de resposta, nem nenhuma rota real. Para o usuário conseguir logar no app e o resto do sistema (categorias, recorrências, lançamentos) ter alguém a quem pertencer, é preciso primeiro existir uma conta e uma sessão autenticada. Este change entrega a fundação de infraestrutura (config, Drizzle, envelope de resposta) e o módulo `auth` (registro, login, refresh, logout) juntos, já que nenhuma parte da fundação existe ainda e o `auth` é o primeiro consumidor real dela.

## What Changes

- Adicionar validação de variáveis de ambiente no boot (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`) via Zod, falhando o startup se algo estiver ausente/inválido
- Configurar client Drizzle + Postgres (`database` module) e criar o schema `users` (`id`, `email`, `password_hash`, `refresh_token_hash`, `refresh_token_expires_at`, `created_at`, `updated_at`), com migration inicial via `drizzle-kit generate`/`migrate`
- Criar o exception filter global e o interceptor de resposta que aplicam o envelope padronizado (`{ data, error, meta }`) a toda a API, incluindo respostas de erro
- Definir prefixo global `/v1` em `main.ts`
- Criar `JwtAuthGuard` (valida access token) e decorator `@CurrentUser()` em `common`
- Implementar módulo `auth` com:
  - `POST /v1/auth/register` — cria usuário (email + senha, hash bcrypt), retorna já autenticado (access + refresh token). Email duplicado → 409
  - `POST /v1/auth/login` — valida credenciais, retorna access + refresh token. Usuário inexistente ou senha incorreta → mesma resposta 401 genérica, sem indicar qual dos dois falhou
  - `POST /v1/auth/refresh` — valida refresh token (JWT + hash no banco), rotaciona o par (emite novo access + novo refresh, sobrescreve o hash). Reuso de um refresh token já rotacionado invalida a sessão (limpa o hash, força novo login)
  - `POST /v1/auth/logout` — protegido por `JwtAuthGuard`, limpa `refresh_token_hash` do usuário autenticado
- Sessão única por usuário: novo login/refresh sobrescreve o hash anterior; não há suporte a múltiplos dispositivos simultâneos nesta fase
- Sem rate limiting e sem exigência de complexidade de senha nesta fase (decisão explícita do usuário para este estágio do projeto)

## Capabilities

### New Capabilities
- `user-auth`: registro, login, refresh e logout de usuários via JWT (access curto + refresh longo de sessão única), incluindo as regras de resposta genérica no login e conflito de email no registro

### Modified Capabilities
_Nenhuma — não há specs existentes no projeto (`openspec list --specs` vazio)._

## Impact

- **Novo código**: `src/config/`, `src/database/` (client Drizzle + schema `users` + migrations), `src/common/` (exception filter, response interceptor, `JwtAuthGuard`, `@CurrentUser()`), `src/auth/` (controller, service, repository, dto, strategy)
- **Novas dependências**: `drizzle-orm`, `drizzle-kit`, `pg` (ou `postgres`), `zod`, `drizzle-zod`, `bcrypt`, `@nestjs/jwt`, `@nestjs/config`
- **`main.ts`**: passa a registrar prefixo global `/v1`, o exception filter e o interceptor de resposta
- **Variáveis de ambiente**: novo `.env.example` com `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`
- **Banco de dados**: primeira migration do projeto, cria a tabela `users`
- Não afeta `categories`, `recurrences`, `monthly-entries`, `transactions` — esses módulos ainda não existem e ficam fora deste change

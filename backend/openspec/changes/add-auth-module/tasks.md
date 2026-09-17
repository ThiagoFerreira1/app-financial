## 1. Dependências

- [ ] 1.1 Adicionar `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `zod`, `drizzle-zod`, `bcrypt`, `@types/bcrypt`, `@nestjs/jwt`, `@nestjs/config` ao `package.json` e verificar que `npm install` conclui sem erros
- [ ] 1.2 Criar `.env.example` com `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT` e verificar que `.env` (não versionado) segue o mesmo formato

## 2. Configuração de ambiente

- [ ] 2.1 Criar `src/config/env.validation.ts` com schema Zod para `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT` e verificar que a aplicação falha o boot com mensagem clara quando uma variável obrigatória está ausente
- [ ] 2.2 Registrar `ConfigModule.forRoot({ validate })` no `AppModule` e verificar que `process.env` validado fica disponível via `ConfigService`

## 3. Banco de dados (Drizzle)

- [ ] 3.1 Criar `src/database/schema/users.schema.ts` com as colunas `id` (uuid, pk), `email` (unique), `password_hash`, `refresh_token_hash` (nullable), `refresh_token_expires_at` (nullable), `created_at`, `updated_at`
- [ ] 3.2 Criar `src/database/drizzle.module.ts` como provider injetável do client Drizzle (usa `DATABASE_URL` do `ConfigService`) e verificar que o módulo exporta o client corretamente tipado
- [ ] 3.3 Configurar `drizzle.config.ts` e gerar a primeira migration com `drizzle-kit generate`, revisando o SQL gerado
- [ ] 3.4 Aplicar a migration com `drizzle-kit migrate` contra um Postgres local e verificar que a tabela `users` existe com o schema esperado

## 4. Infraestrutura compartilhada (`common`)

- [ ] 4.1 Criar o exception filter global em `src/common/filters/` que formata qualquer erro no envelope `{ data: null, error: { message, code }, meta: {} }` e verificar manualmente com uma rota que lança erro
- [ ] 4.2 Criar o response interceptor em `src/common/interceptors/` que envolve toda resposta de sucesso em `{ data, error: null, meta: {} }` e verificar manualmente com uma rota de sucesso
- [ ] 4.3 Registrar prefixo global `/v1`, o exception filter e o interceptor em `main.ts`
- [ ] 4.4 Criar `JwtAuthGuard` em `src/common/guards/` que valida o access token via `@nestjs/jwt` usando `JWT_ACCESS_SECRET`
- [ ] 4.5 Criar decorator `@CurrentUser()` em `src/common/decorators/` que extrai o usuário autenticado do request e verificar que retorna o `sub` do token decodificado

## 5. Módulo `auth` — DTOs

- [ ] 5.1 Criar `src/auth/dto/register.dto.ts` com schema Zod (`email`, `password` — apenas obrigatórios/não vazios, sem regra de complexidade) e verificar que payloads inválidos são rejeitados com 400
- [ ] 5.2 Criar `src/auth/dto/login.dto.ts` com schema Zod (`email`, `password`)
- [ ] 5.3 Criar `src/auth/dto/refresh.dto.ts` com schema Zod (`refreshToken`)

## 6. Módulo `auth` — Repository

- [ ] 6.1 Criar `src/auth/auth.repository.ts` com métodos `findByEmail`, `create`, `updateRefreshTokenHash` (aceita hash + expiração ou `null` pra limpar), usando apenas queries Drizzle, sem lógica de negócio
- [ ] 6.2 Verificar manualmente cada método do repository contra o Postgres local (criar usuário, buscar por email, atualizar e limpar o hash)

## 7. Módulo `auth` — Service

- [ ] 7.1 Implementar `register()`: valida email único (409 se duplicado via exceção de domínio), grava `password_hash` (bcrypt), emite e retorna access + refresh token
- [ ] 7.2 Implementar geração de tokens: helper que assina access token (`JWT_ACCESS_SECRET`, 15min) e refresh token (`JWT_REFRESH_SECRET`, 30 dias), calcula o hash SHA-256 do refresh token e persiste via `updateRefreshTokenHash`
- [ ] 7.3 Implementar `login()`: busca usuário por email, compara senha com bcrypt; se usuário não existe OU senha não confere, lança a mesma exceção 401 genérica (mensagem idêntica nos dois casos) e verificar que os dois cenários retornam corpo de resposta idêntico
- [ ] 7.4 Implementar `refresh()`: verifica assinatura e expiração do refresh token recebido, compara seu hash com `refresh_token_hash` armazenado; se não bater, limpa o hash (invalida sessão) e rejeita; se bater, rotaciona (gera novo par, sobrescreve o hash) e verificar cenário de reuso (chamar refresh duas vezes com o mesmo token antigo)
- [ ] 7.5 Implementar `logout()`: recebe o `userId` do usuário autenticado (via `@CurrentUser()`) e limpa `refresh_token_hash`/`refresh_token_expires_at`

## 8. Módulo `auth` — Controller

- [ ] 8.1 Criar `AuthController` com `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (rotas públicas) e verificar que cada uma responde no envelope padronizado
- [ ] 8.2 Adicionar `POST /auth/logout` protegido por `JwtAuthGuard` e verificar que uma chamada sem token válido retorna 401 sem alterar nenhuma sessão
- [ ] 8.3 Registrar `AuthModule` (controller + service + repository + `JwtModule`) no `AppModule`

## 9. Verificação end-to-end manual

- [ ] 9.1 Rodar o fluxo completo manualmente (registro → login → refresh → refresh com token antigo reutilizado → logout → refresh após logout) contra o Postgres local e confirmar que cada passo se comporta conforme os cenários da spec `user-auth`

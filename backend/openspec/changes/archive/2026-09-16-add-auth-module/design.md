## Context

O repositório é um scaffold `nest new` sem nenhuma infraestrutura além do controller/service de exemplo (ver proposal.md - Why). Este design cobre tanto a fundação (config, database, common) quanto o módulo `auth`, já que a segunda depende inteiramente da primeira e nada disso existe ainda. `CLAUDE.md` já fixa: NestJS + Drizzle + Postgres, Zod para validação, UUID como PK, valores monetários em centavos (não se aplica aqui), envelope de resposta `{ data, error, meta }`, prefixo `/v1`, e a proibição de persistir status derivado (não aplicável a auth, mas mantém o padrão de "nunca persistir o que pode ser calculado").

## Goals / Non-Goals

**Goals:**
- Fundação mínima e reutilizável (config, Drizzle client, envelope de resposta, guard) que os próximos módulos (`categories`, `recurrences`, `monthly-entries`) vão herdar sem retrabalho
- Fluxo completo de auth (registro, login, refresh com rotação, logout) com sessão única por usuário

**Non-Goals:**
- Multi-sessão / múltiplos dispositivos simultâneos (decisão explícita do usuário: sessão única por enquanto)
- Rate limiting, exigência de senha forte, verificação de email, login social, MFA — todos fora de escopo nesta fase
- Testes automatizados (convenção do projeto: não gerar testes sem pedido explícito)

## Decisions

**1. Refresh token: sessão única via coluna em `users`, não tabela separada.**
`users.refresh_token_hash` + `users.refresh_token_expires_at` (ambos nullable). Alternativa considerada: tabela `refresh_tokens` para multi-dispositivo — descartada porque o usuário confirmou que sessão única é suficiente por enquanto; menos uma tabela e um join para manter.

**2. Refresh token é um JWT, não uma string opaca.**
Ambos access e refresh são JWTs assinados com secrets distintos (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), cada um com `sub` (user id) e `exp`. O hash do refresh token (não o token em si) fica salvo em `users.refresh_token_hash` — a assinatura JWT garante integridade/autenticidade, e a checagem contra o hash no banco é o que permite revogação antes da expiração natural (rotação e logout). Decisão do usuário, que preferiu manter os dois tokens na mesma tecnologia em vez da alternativa mais simples (string aleatória opaca) que eu havia recomendado.

**3. Hash do refresh token: SHA-256, não bcrypt.**
`password_hash` usa bcrypt (custo computacional intencional contra brute-force de senhas de baixa entropia, exigência do CLAUDE.md). O refresh token já é um JWT assinado de alta entropia — bcrypt adicionaria custo de CPU sem ganho de segurança real nesse caso. SHA-256 (via `node:crypto`, sem dependência nova) é suficiente para comparar "esse token bate com o que está salvo".

**4. Rotação com detecção de reuso via hash único (não histórico de gerações).**
A cada `/auth/refresh` bem-sucedido, o hash salvo é sobrescrito pelo novo. Se um refresh token antigo (já rotacionado) for apresentado, seu hash não vai bater com o hash atual — nesse caso, em vez de simplesmente rejeitar, o sistema limpa `refresh_token_hash` (invalida a sessão inteira), forçando novo login. Isso é a assinatura clássica de "meu refresh token vazou e alguém mais o usou depois de mim" - resposta é revogar tudo, não só rejeitar a tentativa.

**5. Endpoint de refresh não passa pelo `JwtAuthGuard`.**
O guard valida access token; no momento do refresh o access token pode já estar expirado (esse é o cenário normal de uso). O `AuthService` decodifica o refresh token diretamente (verifica assinatura com `JWT_REFRESH_SECRET`, extrai `sub`, compara hash) em vez de depender do guard.

**6. Logout exige access token válido (via `JwtAuthGuard`), não recebe o refresh token no corpo.**
Como a sessão é única por usuário, basta identificar o usuário (pelo access token) para saber qual `refresh_token_hash` limpar. Simplifica o contrato do endpoint.

**7. Validação de env com Zod, aplicada no boot.**
Consistente com a preferência já registrada no CLAUDE.md por Zod/`drizzle-zod` para DTOs. `src/config/env.validation.ts` valida `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT` via `@nestjs/config` (`validate` factory), falhando o boot com erro claro se algo faltar.

**8. Migrations aplicadas manualmente (`drizzle-kit generate` + `migrate`), não automaticamente no boot.**
Segue a convenção já definida na seção 6 do CLAUDE.md. Evita migração acidental de schema em ambiente errado.

**9. Envelope de resposta e exception filter são globais, implementados em `common/`, não específicos de `auth`.**
Embora só o `auth` exista como consumidor agora, a seção 7 do CLAUDE.md já define esse formato como padrão de toda a API — construir isso escopado a um módulo só geraria retrabalho no próximo.

## Risks / Trade-offs

- **[Risco] Sessão única pode surpreender o usuário** se ele logar em um segundo dispositivo esperando manter o primeiro ativo → Mitigado por ser uma decisão explícita e documentada; revisitar se o app mobile evoluir para uso em múltiplos dispositivos.
- **[Risco] Detecção de reuso por hash único não distingue "token realmente vazado" de "race condition de duas requisições de refresh quase simultâneas do mesmo cliente"** (ex.: retry de rede) → Aceitável nesta fase (projeto pessoal, baixo tráfego); se virar problema, a mitigação seria um pequeno grace period ou client-side evitar refresh concorrente.
- **[Trade-off] JWT para refresh token é redundante com a checagem de hash no banco** (a assinatura por si só não permite revogação) → Aceito por decisão explícita do usuário; custo é só um pouco mais de código (verify de dois secrets) sem custo de segurança real.

## Migration Plan

1. Instalar dependências novas (`drizzle-orm`, `drizzle-kit`, `pg`, `zod`, `drizzle-zod`, `bcrypt`, `@nestjs/jwt`, `@nestjs/config`)
2. Criar `.env.example` e validação de env
3. Criar client Drizzle + schema `users` + gerar/aplicar a primeira migration
4. Criar `common/` (filter, interceptor, guard, decorator) e ligar em `main.ts`/`AppModule`
5. Criar módulo `auth` (dto, repository, service, controller)
6. Sem dado existente para migrar (banco novo) — sem estratégia de rollback além de reverter a migration inicial (`drizzle-kit` mantém histórico versionado em Git, conforme seção 6 do CLAUDE.md)

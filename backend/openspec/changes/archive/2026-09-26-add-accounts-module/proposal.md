## Why

Hoje não existe nenhuma âncora de saldo no sistema — `recurrences`/`monthly_entries`/`transactions` só sabem categorizar e datar um lançamento, nunca "de onde" o dinheiro sai ou entra, nem quanto o usuário efetivamente tem. Isso bloqueia a funcionalidade mais básica de um app de controle financeiro: saber "quanto vou ter" numa data futura. `accounts` é o pré-requisito direto do módulo de previsão de caixa (próximo change) e também um requirement de produto em si (o usuário pode ter conta corrente, poupança, carteira).

## What Changes

- Criar a tabela `accounts` (conta de saldo simples — corrente, poupança, carteira/dinheiro; **cartão de crédito fica fora deste change**, tem lógica de fatura/limite própria que merece modelagem separada):
  - `POST /v1/accounts` — cria conta (`name`, `initialBalance` opcional, default 0, aceita negativo — uma conta pode começar estourada)
  - `GET /v1/accounts` — lista contas não removidas do usuário, cada uma com `currentBalance` **derivado** (`initial_balance` + soma de `transactions` liquidadas daquela conta — nunca um campo mutável armazenado, pra não correr risco de dessincronizar)
  - `PATCH /v1/accounts/:id` — edita `name`/`initialBalance`
  - `DELETE /v1/accounts/:id` — soft delete, mesmo padrão de `categories` (sem checar se está em uso, sem restore)
- Adicionar `account_id` (**obrigatório**, `NOT NULL`) em `recurrences`, `monthly_entries` e `transactions` — segue o mesmo padrão de ownership cross-módulo já usado pra `category_id` (`AccountsRepository.findOwnedById`)
  - `recurrences`: `account_id` passa a ser exigido na criação e validado na edição, igual `category_id`
  - `monthly_entries`: avulso passa a exigir `account_id` na criação; lançamento gerado por recorrência copia o `account_id` dela; `account_id` editável como os demais campos (`amount`, `description`, `category_id`)
  - `transactions`: `account_id` é copiado do `monthly_entry` no momento do `settle`
- **Migração de dados obrigatória**: como já existem recorrências/lançamentos/transações sem conta, a migration cria uma conta `"Conta Padrão"` (`initial_balance = 0`) para cada usuário existente e vincula todos os registros pré-existentes dessas 3 tabelas a ela, antes de aplicar a constraint `NOT NULL`
- `GET /v1/recurrences` ganha filtro opcional `accountId`, espelhando o filtro já existente por `categoryId`

## Capabilities

### New Capabilities
- `accounts`: criação, listagem (com saldo derivado), edição e remoção lógica de contas de saldo simples, sempre escopadas ao usuário dono

### Modified Capabilities
- `recurrences`: os requirements "Recurrence Creation" e "Recurrence Editing" passam a exigir/validar `account_id`; "Recurrence Listing" ganha o filtro `accountId`

## Impact

- **Novo código**: `src/modules/accounts/` (controller, service, repository, dto, module), `src/database/schema/accounts.schema.ts`
- **Código alterado**: `recurrences` (schema, DTOs, service, controller — novo campo obrigatório + filtro), `monthly-entries` (schema, DTOs, service — novo campo obrigatório, cópia em geração e em settle) — este último ainda é um change aberto (`add-monthly-entries-module`), então é emendado diretamente em vez de receber um delta "Modified" formal
- **Banco de dados**: nova tabela `accounts`; nova coluna `account_id` (FK, `NOT NULL` após backfill) em `recurrences`, `monthly_entries`, `transactions`; migration de dados criando conta padrão por usuário
- **Documentação**: novo `http/accounts.http`; `http/recurrences.http` e `http/monthly-entries.http` atualizados com `accountId` nos exemplos
- Não afeta `auth`, `categories`, `user-auth`
- Pré-requisito direto do próximo change (previsão de caixa / saldo projetado)

## 1. Banco de dados — tabela `accounts`

- [x] 1.1 Criar `src/database/schema/accounts.schema.ts`: `id` (uuid, pk), `user_id` (fk -> `users`), `name` (text), `initial_balance` (integer, default 0), `deleted_at` (timestamp, nullable), `created_at`, `updated_at`
- [x] 1.2 Exportar de `src/database/schema/index.ts`
- [x] 1.3 Gerar a migration com `drizzle-kit generate` (ou escrever manualmente se o ambiente não tiver TTY interativo, como nas vezes anteriores) e aplicar; verificar a tabela via `psql`

## 2. Banco de dados — `account_id` obrigatório em `recurrences`/`monthly_entries`/`transactions`

- [x] 2.1 Adicionar `accountId` (fk -> `accounts`, nullable por enquanto) nos 3 schemas (`recurrences.schema.ts`, `monthly-entries.schema.ts`, `transactions.schema.ts`)
- [x] 2.2 Escrever migration manual com, nesta ordem: (a) `ALTER TABLE ... ADD COLUMN account_id uuid REFERENCES accounts(id)` nas 3 tabelas; (b) `INSERT INTO accounts (id, user_id, name, initial_balance) SELECT gen_random_uuid(), id, 'Conta Padrão', 0 FROM users` (uma conta padrão por usuário existente); (c) `UPDATE recurrences/monthly_entries/transactions SET account_id = (SELECT id FROM accounts WHERE accounts.user_id = <tabela>.user_id AND accounts.name = 'Conta Padrão')`; (d) `ALTER TABLE ... ALTER COLUMN account_id SET NOT NULL` nas 3 tabelas
- [x] 2.3 Atualizar os 3 schemas Drizzle pra refletir `accountId` como `.notNull()` (a coluna já está `NOT NULL` no banco após a migration)
- [x] 2.4 Aplicar a migration e verificar via `psql`: nenhuma linha com `account_id` nulo nas 3 tabelas, e que uma "Conta Padrão" foi criada por usuário que tinha dados

## 3. Módulo `accounts` — DTOs

- [x] 3.1 Criar `create-account.dto.ts`: `name` (string não vazia), `initialBalance` (inteiro, opcional, sem `.positive()` — aceita negativo)
- [x] 3.2 Criar `update-account.dto.ts`: `name`, `initialBalance` opcionais

## 4. Módulo `accounts` — Repository

- [x] 4.1 Criar `accounts.repository.ts` com `create(data)`, `findAllByUser(userId)` (filtra `deleted_at IS NULL`), `findOwnedById(id, userId)`, `update(id, data)`, `softDelete(id)` — mesmo padrão de `CategoriesRepository`
- [x] 4.2 Implementar o cálculo de saldo derivado: método `getCurrentBalance(accountId)` (ou já embutido na query de listagem) que soma `transactions.amount` por `type` (receita soma, despesa subtrai) filtrado por `account_id`, somado ao `initial_balance`
- [x] 4.3 Verificar manualmente: criar conta, criar transações de teste diretamente no banco vinculadas a ela, confirmar que o saldo calculado bate

## 5. Módulo `accounts` — Service, Controller, Module

- [x] 5.1 Implementar `AccountsService` com `create`, `findAll` (retorna cada conta com `currentBalance`), `update`, `remove` (soft delete, sem checar uso) — mesmo padrão de `CategoriesService`
- [x] 5.2 Criar `AccountsController`: `POST /accounts`, `GET /accounts`, `PATCH /accounts/:id`, `DELETE /accounts/:id`, protegidas por `JwtAuthGuard`
- [x] 5.3 Criar `AccountsModule` exportando `AccountsRepository`, registrar no `AppModule`
- [x] 5.4 Verificar manualmente todos os endpoints, incluindo 404 de conta de outro usuário e o `currentBalance` retornado corretamente em cada cenário (saldo inicial só, com transações, negativo)

## 6. Integração com `recurrences`

- [x] 6.1 Adicionar `accountId` (uuid, obrigatório) em `create-recurrence.dto.ts` e `update-recurrence.dto.ts`
- [x] 6.2 Adicionar `accountId` opcional em `find-recurrences-query.dto.ts`
- [x] 6.3 Importar `AccountsModule` em `RecurrencesModule`
- [x] 6.4 Atualizar `RecurrencesService.create`/`update` pra validar `accountId` via `AccountsRepository.findOwnedById` (404 se inválida), mesmo padrão de `categoryId`
- [x] 6.5 Atualizar `RecurrencesRepository.findAllByUser`/`findEligibleForPeriod` (usado por `monthly-entries`) pra aceitar e aplicar filtro por `accountId` quando informado
- [x] 6.6 Verificar manualmente: criar recorrência sem `accountId` (400, campo obrigatório), com `accountId` de outro usuário (404), listar filtrando por `accountId`, editar `accountId` pra um inválido (404)

## 7. Documentação

- [x] 7.1 Criar `http/accounts.http` com exemplo de cada endpoint (criar com/sem saldo inicial, criar com saldo negativo, listar com saldo calculado, editar, remover, erros de ownership, sem token)
- [x] 7.2 Atualizar `http/recurrences.http` incluindo `accountId` nos exemplos de criação/edição e um cenário de conta inválida

## 8. Verificação end-to-end manual

- [x] 8.1 Fluxo completo: criar conta com saldo inicial 10000 → criar categoria → criar recorrência informando `categoryId` e `accountId` → listar contas confirmando `currentBalance` igual a 10000 (nada liquidado ainda) → gerar o lançamento do mês, liquidar → listar contas de novo confirmando que `currentBalance` mudou conforme o `type` (soma se receita, subtrai se despesa) → editar `initialBalance` da conta e confirmar que `currentBalance` recalcula → tentar criar recorrência com `accountId` de outro usuário (404) → remover a conta (soft delete) e confirmar que ela some da listagem mas a recorrência associada continua funcionando (órfã, sem quebrar)

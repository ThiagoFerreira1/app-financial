## 1. Banco de dados (Drizzle)

- [x] 1.1 Criar `src/database/schema/transactions.schema.ts`: `id` (uuid, pk), `user_id` (fk -> `users`), `category_id` (fk -> `categories`), `description` (text), `type` (text, `CHECK IN ('despesa', 'receita')`), `amount` (integer), `paid_at` (timestamp), `created_at`, `updated_at`
- [x] 1.2 Criar `src/database/schema/monthly-entries.schema.ts`: `id` (uuid, pk), `user_id` (fk -> `users`), `recurrence_id` (fk -> `recurrences`, nullable), `category_id` (fk -> `categories`), `transaction_id` (fk -> `transactions`, nullable), `description` (text), `type` (text, `CHECK IN ('despesa', 'receita')`), `amount` (integer), `due_date` (date), `status` (text, `CHECK IN ('pendente', 'pago', 'pulado')`, default `'pendente'`), `month` (integer), `year` (integer), `installment_number` (integer, nullable), `created_at`, `updated_at` — mais um índice único parcial `(recurrence_id, month, year) WHERE recurrence_id IS NOT NULL`
- [x] 1.3 Exportar os dois novos schemas de `src/database/schema/index.ts`
- [x] 1.4 Gerar a migration com `drizzle-kit generate` e revisar o SQL gerado (fks, `CHECK`s, índice único parcial)
- [x] 1.5 Aplicar a migration com `drizzle-kit migrate` contra o Postgres local e verificar as duas tabelas com `\d` no psql

## 2. Módulo `transactions` (sem controller)

- [x] 2.1 Criar `src/modules/transactions/transactions.repository.ts` com `create(data)`, `deleteById(id)` — apenas queries Drizzle
- [x] 2.2 Criar `src/modules/transactions/transactions.module.ts` exportando `TransactionsRepository`, sem controllers

## 3. Módulo `monthly-entries` — DTOs

- [x] 3.1 Criar `create-monthly-entry.dto.ts` (avulso): `description` (string não vazia), `categoryId` (uuid), `type` (enum), `amount` (inteiro positivo), `dueDate` (string de data ISO) — verificar payload inválido rejeitado com 400
- [x] 3.2 Criar `update-monthly-entry.dto.ts`: `description`, `categoryId`, `amount`, `dueDate` opcionais; `type` opcional (validação de "só avulso" fica no Service, não no schema Zod, pois depende do registro)
- [x] 3.3 Criar `find-monthly-entries-query.dto.ts`: `month` (inteiro 1-12, obrigatório), `year` (inteiro, obrigatório)
- [x] 3.4 Criar `pay-monthly-entry.dto.ts`: `paidAt` (string de data ISO, opcional)

## 4. Módulo `monthly-entries` — Repository

- [x] 4.1 Criar `monthly-entries.repository.ts` com: `create(data)` (usa `INSERT ... ON CONFLICT (recurrence_id, month, year) DO NOTHING` quando `recurrence_id` não é nulo, retornando `undefined` se já existia), `findAllByUserAndPeriod(userId, month, year)`, `findOwnedById(id, userId)`, `update(id, data)`, `deleteById(id)`, `markAsPaid(id, transactionId, paidAt)`, `markAsUnpaid(id)`, `markAsSkipped(id)`, `markAsUnskipped(id)`
- [x] 4.2 Verificar manualmente cada método contra o Postgres local, incluindo que inserir duas vezes para a mesma `(recurrence_id, month, year)` não gera erro nem duplicata (o `ON CONFLICT DO NOTHING` absorve)

## 5. Módulo `monthly-entries` — Service: geração e prévia

- [x] 5.1 Implementar um método privado compartilhado `computeEligibleRecurrenceEntries(userId, month, year)`: busca recorrências elegíveis (`active`, não removidas, `created_at` <= mês/ano consultado) via `RecurrencesRepository`, calcula `due_date` (clampado ao último dia do mês) e `installment_number` previsto para cada uma, sem persistir nada — reaproveitado tanto pela geração real quanto pela prévia
- [x] 5.2 Implementar `findAllForPeriod(userId, month, year)`: se mês/ano for atual ou passado (comparado a `now()`), para cada recorrência elegível (via 5.1) tenta inserir seu `monthly_entry` via `create` (idempotente pelo índice único); quando a inserção realmente acontece (não foi `DO NOTHING`) e a recorrência é parcelada, incrementa `installments_generated` da recorrência e desativa (`active: false`) se atingiu `installments_total` — tudo dentro de `db.transaction()`; ao final, retorna todos os `monthly_entries` do usuário/mês/ano (recém-gerados + já existentes + avulsos), cada um com `isOverdue` calculado
- [x] 5.3 Implementar o ramo de **prévia** em `findAllForPeriod`: se mês/ano for futuro, não persiste nada — retorna os avulsos reais já cadastrados pra aquele mês/ano (via `findAllByUserAndPeriod`) combinados com os itens calculados por `computeEligibleRecurrenceEntries` (sem `id`, com `installment_number` estimado como `installments_generated atual + meses de diferença`, omitindo recorrências cujo total estimado ultrapasse `installments_total`)
- [x] 5.4 Implementar o cálculo de `due_date` clampado ao último dia do mês (cobrir fevereiro e meses de 30 dias)
- [x] 5.5 Implementar o campo calculado `isOverdue` (`status === 'pendente' && due_date < hoje`) aplicado a todo `monthly_entry` real retornado (itens de prévia nunca são `isOverdue`, já que não têm `status` persistido)
- [x] 5.6 Verificar manualmente: primeira consulta de um mês gera as recorrências elegíveis; segunda consulta não duplica; recorrência criada **depois** que o mês já foi gerado para outras recorrências ainda assim gera a sua própria na próxima consulta; recorrência inativa não gera; `due_day` 31 num mês de 30 dias clampa corretamente; mês futuro retorna prévia sem persistir nada (confirmar via `psql` que nenhuma linha nova foi criada) e sem incrementar `installments_generated`

## 6. Módulo `monthly-entries` — Service: CRUD de avulso e edição

- [x] 6.1 Implementar `create(userId, dto)`: valida `categoryId` via `CategoriesRepository.findOwnedById` (404 se inválida), calcula `month`/`year` a partir de `dueDate`, cria com `recurrence_id` nulo
- [x] 6.2 Implementar `update(id, userId, dto)`: busca via `findOwnedById` (404 se não encontrar); se `dto.type` for informado e o lançamento tiver `recurrence_id`, rejeita com `BadRequestException`; se `dto.dueDate` for informado, valida que o mês/ano resultante é igual ao `month`/`year` atual do lançamento, senão rejeita com 400; atualiza os campos informados; se `status === 'pago'`, também atualiza a `transaction` vinculada com os mesmos valores de `amount`/`description`/`category_id`
- [x] 6.3 Implementar `remove(id, userId)`: busca via `findOwnedById` (404 se não encontrar); rejeita com `ConflictException` se tiver `recurrence_id`; rejeita com `ConflictException` se `transaction_id` estiver preenchido; caso contrário, exclui fisicamente
- [x] 6.4 Verificar manualmente cada cenário (edição de avulso incluindo `type`, edição de vinculado a recorrência rejeitando `type`, `due_date` fora do mês rejeitado, edição de já pago sincronizando a transaction, delete de vinculado a recorrência rejeitado, delete de avulso pago rejeitado, delete de avulso não pago funcionando)

## 7. Módulo `monthly-entries` — Service: pay/unpay

- [x] 7.1 Implementar `pay(id, userId, dto)`: busca via `findOwnedById` (404 se não encontrar); rejeita com `ConflictException` se `status` for `'pago'` ou `'pulado'`; cria a `transaction` via `TransactionsRepository.create` copiando `category_id`/`description`/`type`/`amount`, com `paid_at` = `dto.paidAt` ou `now()`; atualiza o `monthly_entry` com `transaction_id`/`status: 'pago'`
- [x] 7.2 Implementar `unpay(id, userId)`: busca via `findOwnedById` (404 se não encontrar); rejeita com `ConflictException` se `status !== 'pago'`; apaga a `transaction` vinculada via `TransactionsRepository.deleteById`; limpa `transaction_id`/`status: 'pendente'` no `monthly_entry`
- [x] 7.3 Verificar manualmente: pagar um pendente cria a transaction; pagar um já pago ou pulado rejeita (409); pagar com `paidAt` retroativo grava a data certa; desmarcar remove a transaction e volta pendente; desmarcar um já pendente rejeita (409)

## 8. Módulo `monthly-entries` — Service: skip/unskip

- [x] 8.1 Implementar `skip(id, userId)`: busca via `findOwnedById` (404 se não encontrar); rejeita com `BadRequestException` se não tiver `recurrence_id` (avulso); rejeita com `ConflictException` se `status !== 'pendente'`; define `status: 'pulado'`
- [x] 8.2 Implementar `unskip(id, userId)`: busca via `findOwnedById` (404 se não encontrar); rejeita com `ConflictException` se `status !== 'pulado'`; define `status: 'pendente'`
- [x] 8.3 Verificar manualmente: pular um lançamento de recorrência pendente funciona; pular um avulso rejeita (400); pular um já pago ou já pulado rejeita (409); desfazer o skip volta pendente; desfazer skip de algo não pulado rejeita (409); confirmar que `installments_generated` da recorrência não muda ao pular/despular

## 9. Módulo `monthly-entries` — Controller e Module

- [x] 9.1 Criar `monthly-entries.controller.ts`: `GET /monthly-entries` (query `month`/`year`), `POST /monthly-entries`, `PATCH /monthly-entries/:id`, `DELETE /monthly-entries/:id`, `POST /monthly-entries/:id/pay`, `POST /monthly-entries/:id/unpay`, `POST /monthly-entries/:id/skip`, `POST /monthly-entries/:id/unskip` — todas protegidas por `JwtAuthGuard` e usando `@CurrentUser()`
- [x] 9.2 Verificar que cada rota responde no envelope padronizado e que uma chamada sem token válido retorna 401
- [x] 9.3 Criar `monthly-entries.module.ts` (importa `RecurrencesModule`, `CategoriesModule`, `TransactionsModule`, `DrizzleModule`, `CommonModule`) e registrar no `AppModule`

## 10. Documentação

- [x] 10.1 Criar `http/monthly-entries.http` com exemplo de cada endpoint e dos principais cenários de erro (mês futuro retornando prévia, categoria inválida, editar type de vinculado a recorrência, due_date fora do mês, deletar vinculado a recorrência, deletar avulso pago, pagar já pago/pulado, desmarcar já pendente, pular avulso, pular já pago/pulado, sem token, lançamento de outro usuário)

## 11. Verificação end-to-end manual

- [x] 11.1 Fluxo completo: criar categoria + recorrência (com e sem parcelas) → consultar mês atual (gera lançamentos) → consultar de novo (não duplica) → cadastrar recorrência nova e confirmar que ela gera na próxima consulta do mesmo mês (sem precisar do mês inteiro "resetar") → criar avulso → editar avulso (incluindo type) → editar lançamento de recorrência (type rejeitado) → pagar um lançamento → editar o já pago (sincroniza transaction) → desmarcar → pular um lançamento de recorrência → tentar pagar o pulado (409) → desfazer o skip → deletar avulso não pago → tentar deletar vinculado a recorrência (409) → tentar deletar avulso pago (409) → consultar mês futuro (retorna prévia sem persistir) → confirmar `isOverdue` em um lançamento pendente vencido → gerar parcelas suficientes pra uma recorrência parcelada esgotar e confirmar auto-desativação → aumentar `installments_total` da desativada e confirmar que continua `active: false` até reativação manual

## 12. Renomeação `pago`/`pay`/`paid_at` → `liquidado`/`settle`/`settled_at`

Vocabulário original ("pago", `/pay`, `paid_at`) não fazia sentido pra lançamentos de receita — corrigido após revisão manual (ver design.md).

- [x] 12.1 Alterar `monthly-entries.schema.ts`: `status` union e `CHECK` de `'pago'` para `'liquidado'`
- [x] 12.2 Alterar `transactions.schema.ts`: coluna `paidAt`/`paid_at` para `settledAt`/`settled_at`
- [x] 12.3 Escrever migration manual (`0005_rename_paid_at_to_settled_at.sql`) e snapshot correspondente (sem `drizzle-kit generate` interativo, indisponível no ambiente): `RENAME COLUMN`, `DROP CONSTRAINT`, `UPDATE` dos dados existentes de `'pago'` para `'liquidado'`, `ADD CONSTRAINT` com os novos valores — aplicar e verificar via `psql`
- [x] 12.4 Renomear `pay-monthly-entry.dto.ts` → `settle-monthly-entry.dto.ts` (`paidAt` → `settledAt`)
- [x] 12.5 Renomear `MonthlyEntriesRepository.markAsPaid`/`markAsUnpaid` → `markAsSettled`/`markAsUnsettled`, usando `'liquidado'`
- [x] 12.6 Renomear `MonthlyEntriesService.pay`/`unpay` → `settle`/`unsettle`, mensagens de erro atualizadas para vocabulário neutro (`'liquidado'` em vez de `'pago'`)
- [x] 12.7 Renomear rotas do controller: `POST /monthly-entries/:id/pay` → `/settle`, `/unpay` → `/unsettle`
- [x] 12.8 Atualizar `http/monthly-entries.http`, `CLAUDE.md` (schema de `monthly_entries`/`transactions`, seção 5.2, convenção de idioma) e os artefatos deste change (`proposal.md`, `specs/monthly-entries/spec.md`, `design.md`) para o novo vocabulário
- [x] 12.9 Rebuild + lint completos e reteste manual dos fluxos de liquidar/desfazer liquidação/pular após a renomeação

## 13. `account_id` obrigatório (emenda coordenada com `add-accounts-module`)

Depende de `accounts` já existir (schema, `AccountsModule` exportando `AccountsRepository`) e da migration de `add-accounts-module` já ter criado a "Conta Padrão" por usuário — executar depois daquele change, não antes.

- [x] 13.1 Adicionar `accountId` (uuid, obrigatório) em `create-monthly-entry.dto.ts` e `update-monthly-entry.dto.ts`
- [x] 13.2 Importar `AccountsModule` em `MonthlyEntriesModule`
- [x] 13.3 Atualizar `MonthlyEntriesService.create`/`update` pra validar `accountId` via `AccountsRepository.findOwnedById` (404 se inválida), mesmo padrão de `categoryId`
- [x] 13.4 Atualizar `generateForPeriod`/`buildPreview` pra copiar `accountId` da recorrência no `monthly_entry` gerado
- [x] 13.5 Atualizar `settle()` pra copiar `accountId` do `monthly_entry` pra `transaction`; atualizar `update()` pra sincronizar `accountId` na `transaction` quando um lançamento já liquidado tiver o `accountId` editado
- [x] 13.6 Atualizar `http/monthly-entries.http` incluindo `accountId` nos exemplos de criação/edição e um cenário de conta inválida
- [x] 13.7 Verificar manualmente: criar avulso sem `accountId` (400), com `accountId` de outro usuário (404), gerar lançamento de recorrência confirmando que `accountId` foi copiado, liquidar confirmando `accountId` na `transaction`, editar `accountId` de um lançamento já liquidado e confirmar sincronização

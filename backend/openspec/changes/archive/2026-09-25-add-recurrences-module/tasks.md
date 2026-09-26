## 1. Banco de dados (Drizzle)

- [x] 1.1 Criar `src/database/schema/recurrences.schema.ts` com as colunas `id` (uuid, pk), `user_id` (uuid, fk -> `users`), `category_id` (uuid, fk -> `categories`), `description` (text), `type` (text, `'despesa' | 'receita'`), `default_amount` (integer), `due_day` (integer), `active` (boolean, default true), `deleted_at` (timestamp, nullable), `created_at`, `updated_at`, e exportar de `src/database/schema/index.ts`
- [x] 1.2 Gerar a migration com `drizzle-kit generate` e revisar o SQL gerado (fks corretas para `users` e `categories`, colunas nullable corretas)
- [x] 1.3 Aplicar a migration com `drizzle-kit migrate` contra o Postgres local e verificar que a tabela `recurrences` existe com o schema esperado

## 2. Expor `CategoriesRepository` para outros módulos

- [x] 2.1 Adicionar `exports: [CategoriesRepository]` em `CategoriesModule` e verificar que o build continua passando

## 3. Módulo `recurrences` — DTOs

- [x] 3.1 Criar `src/modules/recurrences/dto/create-recurrence.dto.ts` com schema Zod: `description` (string não vazia), `categoryId` (uuid), `type` (enum `'despesa' | 'receita'`), `defaultAmount` (inteiro positivo), `dueDay` (inteiro entre 1 e 31) — verificar que payload inválido em cada campo é rejeitado com 400
- [x] 3.2 Criar `src/modules/recurrences/dto/update-recurrence.dto.ts` com os mesmos campos do create, mais `active` (boolean), todos opcionais (edição parcial)
- [x] 3.3 Criar `src/modules/recurrences/dto/find-recurrences-query.dto.ts` com schema Zod: `active` (boolean opcional, default `true` quando ausente), `categoryId` (uuid opcional)

## 4. Módulo `recurrences` — Repository

- [x] 4.1 Criar `src/modules/recurrences/recurrences.repository.ts` com `create(data)`, `findAllByUser(userId, filters: { active?, categoryId? })` (sempre filtra `deleted_at IS NULL`), `findOwnedById(id, userId)` (filtra `id` + `user_id` + `deleted_at IS NULL`, reaproveitado por update e soft delete), `update(id, data)`, `softDelete(id)` (seta `deleted_at` e `active = false` na mesma escrita) — apenas queries Drizzle, sem lógica de negócio
- [x] 4.2 Verificar manualmente cada método do repository contra o Postgres local (criar, listar com cada combinação de filtro, buscar por id+usuário, editar, soft delete confirmando que `active` vira `false`)

## 5. Módulo `recurrences` — Service

- [x] 5.1 Implementar `create(userId, dto)`: valida `categoryId` via `CategoriesRepository.findOwnedById(dto.categoryId, userId)`, lança `NotFoundException` se não encontrar; caso contrário cria a recorrência vinculada ao `userId` com `active: true` e retorna a recorrência criada
- [x] 5.2 Implementar `findAll(userId, filters)`: aplica `active: true` como padrão quando não informado, repassa `categoryId` se presente, retorna as recorrências do usuário
- [x] 5.3 Implementar `update(id, userId, dto)`: busca via `findOwnedById`; se não encontrar, lança `NotFoundException`; se `dto.categoryId` for informado, valida via `CategoriesRepository.findOwnedById` e lança `NotFoundException` se inválida; caso contrário atualiza os campos informados e retorna a recorrência atualizada — verificar os cenários de "não encontrado" (recorrência de outro usuário, já removida) e de categoria inválida na edição
- [x] 5.4 Implementar `remove(id, userId)`: busca via `findOwnedById`; se não encontrar, lança `NotFoundException`; caso contrário preenche `deleted_at` e `active: false` na mesma chamada de `softDelete` — verificar que a recorrência removida deixa de aparecer em `findAll` e que fica com `active: false`

## 6. Módulo `recurrences` — Controller

- [x] 6.1 Criar `src/modules/recurrences/controller/recurrences.controller.ts` com `POST /recurrences`, `GET /recurrences`, `PATCH /recurrences/:id`, `DELETE /recurrences/:id`, todas protegidas por `JwtAuthGuard` e usando `@CurrentUser()` para obter o `userId`
- [x] 6.2 Verificar que cada rota responde no envelope padronizado e que uma chamada sem token válido retorna 401 sem alterar nenhuma recorrência
- [x] 6.3 Criar `src/modules/recurrences/recurrences.module.ts` (importa `CategoriesModule` e `DrizzleModule`/`CommonModule`; controller + service + repository) e registrar no `AppModule`

## 7. Documentação

- [x] 7.1 Criar `http/recurrences.http` com exemplo de cada endpoint (criar, listar com e sem filtros, editar, remover) e dos cenários de erro (categoria inválida/de outro usuário na criação e edição, editar/remover recorrência de outro usuário, editar/remover recorrência já removida, valores inválidos de `default_amount`/`due_day`, sem token)

## 8. Verificação end-to-end manual

- [x] 8.1 Rodar o fluxo completo manualmente (criar categoria de apoio → criar recorrência → listar (só ativas) → pausar via PATCH `active: false` → listar `active=false` confirmando que aparece → reativar → editar categoria pra uma inválida, 404 → remover → confirmar `active: false` e ausência na listagem → tentar editar/remover a já removida, 404 → tentar editar/remover recorrência de outro usuário, 404 → criar com `default_amount` zero/negativo e `due_day` fora de 1-31, 400) contra o Postgres local e confirmar que cada passo se comporta conforme os cenários da spec `recurrences`

## 9. Parcelas (`installments_total` / `installments_generated`)

- [x] 9.1 Adicionar as colunas `installments_total` (integer, nullable) e `installments_generated` (integer, not null, default 0) em `recurrences.schema.ts`, gerar nova migration com `drizzle-kit generate`, revisar o SQL e aplicar com `drizzle-kit migrate`
- [x] 9.2 Adicionar `installmentsTotal` opcional (`z.number().int().min(1)`) em `create-recurrence.dto.ts` e `update-recurrence.dto.ts` — verificar que `installments_generated` enviado no body é ignorado (não existe no schema Zod, é descartado pelo modo `strip` padrão)
- [x] 9.3 Atualizar `RecurrencesService.create` para repassar `installmentsTotal` (ou `null`) ao repository; `installments_generated` nunca é setado pelo service na criação (usa o default `0` do banco)
- [x] 9.4 Atualizar `RecurrencesService.update` para, se `dto.installmentsTotal` for informado, rejeitar com `BadRequestException` quando for menor que o `installments_generated` atual da recorrência buscada
- [x] 9.5 Verificar manualmente: criar recorrência sem `installmentsTotal` (fica `null`, `installments_generated` 0); criar com `installmentsTotal: 12` (`installments_generated` 0); criar/editar com `installmentsTotal` zero ou negativo (400); usar `psql` pra simular `installments_generated` avançado (ex: 5) e confirmar que editar `installmentsTotal` para um valor menor que 5 retorna 400, e que editar para um valor maior ou igual funciona
- [x] 9.6 Atualizar `http/recurrences.http` com exemplos de criação com `installmentsTotal`, edição de `installmentsTotal`, e o erro de `installmentsTotal` inválido

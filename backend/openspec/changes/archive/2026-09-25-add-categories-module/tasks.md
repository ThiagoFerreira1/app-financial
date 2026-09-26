## 1. Banco de dados (Drizzle)

- [x] 1.1 Criar `src/database/schema/categories.schema.ts` com as colunas `id` (uuid, pk), `user_id` (uuid, fk -> `users`), `name` (text), `deleted_at` (timestamp, nullable), `created_at`, `updated_at`, e exportar de `src/database/schema/index.ts`
- [x] 1.2 Adicionar índice único parcial em `(user_id, lower(name))` filtrando `deleted_at IS NULL` (via `uniqueIndex` do Drizzle) e verificar que o SQL gerado reflete esse índice
- [x] 1.3 Gerar a migration com `drizzle-kit generate` e revisar o SQL gerado (fk correta para `users`, colunas nullable corretas, índice único parcial presente)
- [x] 1.4 Aplicar a migration com `drizzle-kit migrate` contra o Postgres local e verificar que a tabela `categories` existe com o schema e o índice esperados

## 2. Módulo `categories` — DTOs

- [x] 2.1 Criar `src/modules/categories/dto/create-category.dto.ts` com schema Zod (`name`, string não vazia) e verificar que payload inválido é rejeitado com 400
- [x] 2.2 Criar `src/modules/categories/dto/update-category.dto.ts` com o mesmo schema de `name`

## 3. Módulo `categories` — Repository

- [x] 3.1 Criar `src/modules/categories/categories.repository.ts` com `create(userId, data)`, `findAllByUser(userId)` (filtra `deleted_at IS NULL`), `findOwnedById(id, userId)` (filtra `id` + `user_id` + `deleted_at IS NULL`, reaproveitado por update e soft delete), `findByNameCaseInsensitive(userId, name, excludeId?)` (filtra `user_id` + `lower(name) = lower(:name)` + `deleted_at IS NULL`, aceita excluir um `id` da busca), `update(id, data)`, `softDelete(id)` — apenas queries Drizzle, sem lógica de negócio
- [x] 3.2 Verificar manualmente cada método do repository contra o Postgres local (criar categoria, listar só as não deletadas do usuário certo, buscar por id+usuário, buscar por nome case-insensitive ignorando removidas, editar, soft delete)

## 4. Módulo `categories` — Service

- [x] 4.1 Implementar `create(userId, dto)`: checa duplicidade via `findByNameCaseInsensitive(userId, dto.name)`; se encontrar, lança `ConflictException`; caso contrário cria a categoria vinculada ao `userId` e retorna a categoria criada — verificar que criar duas categorias com o mesmo nome (variando maiúsculas/minúsculas) retorna 409 na segunda
- [x] 4.2 Implementar `findAll(userId)`: retorna as categorias não removidas do usuário
- [x] 4.3 Implementar `update(id, userId, dto)`: busca via `findOwnedById`; se não encontrar (não existe, é de outro usuário, ou já removida), lança `NotFoundException`; se encontrar, checa duplicidade via `findByNameCaseInsensitive(userId, dto.name, excludeId: id)`; se encontrar outra categoria com esse nome, lança `ConflictException`; caso contrário atualiza o `name` e retorna a categoria atualizada — verificar que os três casos de "não encontrado" retornam 404, que renomear para um nome já usado por outra categoria retorna 409, e que renomear mantendo o nome atual funciona normalmente
- [x] 4.4 Implementar `remove(id, userId)`: busca via `findOwnedById`; se não encontrar, lança `NotFoundException`; caso contrário preenche `deleted_at` — verificar que a categoria removida deixa de aparecer em `findAll` e que seu nome pode ser reutilizado em uma nova categoria

## 5. Módulo `categories` — Controller

- [x] 5.1 Criar `src/modules/categories/controller/categories.controller.ts` com `POST /categories`, `GET /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`, todas protegidas por `JwtAuthGuard` e usando `@CurrentUser()` para obter o `userId`
- [x] 5.2 Verificar que cada rota responde no envelope padronizado e que uma chamada sem token válido retorna 401 sem alterar nenhuma categoria
- [x] 5.3 Criar `src/modules/categories/categories.module.ts` (controller + service + repository) e registrar no `AppModule`

## 6. Documentação

- [x] 6.1 Criar `http/categories.http` com exemplo de cada endpoint (criar, listar, editar, remover) e dos cenários de erro (editar/remover categoria de outro usuário, editar/remover categoria já removida, sem token, criar/renomear com nome duplicado)

## 7. Verificação end-to-end manual

- [x] 7.1 Rodar o fluxo completo manualmente (criar categoria → listar → editar → remover → listar de novo confirmando que sumiu → tentar editar/remover a já removida → tentar editar/remover categoria de outro usuário → criar categoria com nome já usado, 409 → remover categoria e recriar com o mesmo nome, sucesso) contra o Postgres local e confirmar que cada passo se comporta conforme os cenários da spec `categories`

## Why

Hoje só existe o módulo `auth` — não há como o usuário organizar seus lançamentos por tipo de gasto/receita. `categories` é pré-requisito direto de `recurrences` e `monthly_entries` (ambos terão `category_id` como FK obrigatória), então precisa existir antes desses módulos.

## What Changes

- Criar a tabela `categories` (`id`, `user_id` fk -> `users`, `name`, `deleted_at` nullable, `created_at`, `updated_at`) e gerar a migration correspondente
- Implementar o módulo `categories` (controller/service/repository, seguindo a mesma convenção física do módulo `auth`: `controller/`, `service/`, `dto/`):
  - `POST /v1/categories` — cria uma categoria (`name`) para o usuário autenticado; rejeita nome duplicado (case-insensitive) entre categorias não removidas do mesmo usuário com 409
  - `GET /v1/categories` — lista as categorias não deletadas do usuário autenticado
  - `PATCH /v1/categories/:id` — edita o `name` de uma categoria do usuário autenticado; mesma regra de nome duplicado da criação se aplica
  - `DELETE /v1/categories/:id` — soft delete (marca `deleted_at`), nunca remove a linha
- Todas as rotas protegidas por `JwtAuthGuard`; toda operação de leitura/escrita é escopada ao `user_id` do token (`@CurrentUser()`) — um usuário nunca acessa/edita categoria de outro
- Adicionar `http/categories.http` com exemplo de cada endpoint e dos principais erros (categoria de outro usuário, categoria inexistente/deletada)

## Capabilities

### New Capabilities
- `categories`: criação, listagem, edição e remoção lógica (soft delete) de categorias de classificação dos lançamentos financeiros, sempre escopadas ao usuário dono

### Modified Capabilities
_Nenhuma — não há requirement de spec existente sendo alterado; `user-auth` não muda._

## Impact

- **Novo código**: `src/modules/categories/` (controller, service, repository, dto, module), `src/database/schema/categories.schema.ts`
- **Banco de dados**: nova migration criando a tabela `categories` (fk para `users`)
- **`app.module.ts`**: registra o novo `CategoriesModule`
- **Documentação**: novo `http/categories.http`
- Não afeta `auth`, `recurrences`, `monthly-entries`, `transactions` — estes últimos três ainda não existem e ficam fora deste change (mas `recurrences`/`monthly-entries` vão consumir `category_id` depois)

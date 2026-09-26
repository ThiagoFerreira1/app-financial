## Why

`recurrences` é o template de conta fixa/variável (aluguel, internet, salário) que o usuário cadastra uma vez para o sistema gerar automaticamente os lançamentos de cada mês — é o requirement #2 do MVP e pré-requisito direto do módulo `monthly-entries` (que ainda não existe e vai consumir as recorrências ativas do usuário para gerar a visão do mês).

## What Changes

- Criar a tabela `recurrences` (`id`, `user_id` fk -> `users`, `category_id` fk -> `categories`, `description`, `type` — `'despesa' | 'receita'`, `default_amount` — inteiro em centavos, `due_day` — 1-31, `active` — boolean default true, `installments_total` — inteiro nullable, `installments_generated` — inteiro default 0, `deleted_at` nullable, `created_at`, `updated_at`) e gerar a migration
- Implementar o módulo `recurrences` (mesma convenção física de `categories`: `controller/`, `service/`, `dto/`):
  - `POST /v1/recurrences` — cria uma recorrência para o usuário autenticado; `category_id` deve pertencer ao usuário e não estar removida, senão 404; `installments_total` é opcional — ausente/`null` significa recorrência indefinida (aluguel, internet), um número significa parcelamento com fim definido (ex: 12x)
  - `GET /v1/recurrences` — lista as recorrências não removidas do usuário autenticado; aceita filtro opcional `active` (boolean) e `categoryId`; por padrão retorna só as ativas (`active=true`) — passar `active=false` explicitamente mostra as pausadas
  - `PATCH /v1/recurrences/:id` — edita `description`, `category_id`, `type`, `default_amount`, `due_day`, `active` e `installments_total` de uma recorrência própria, não removida; `installments_generated` nunca é editável pelo cliente, é gerido internamente pelo futuro `monthly-entries`
  - `DELETE /v1/recurrences/:id` — soft delete (marca `deleted_at` **e força `active = false`** junto, nunca existe o estado "deletada mas ativa"); sem endpoint de restore, mesma política de `categories`
- Todas as rotas protegidas por `JwtAuthGuard`, escopadas ao `user_id` do token, mesmo padrão de ownership de `categories` (`findOwnedById` filtrando `id` + `user_id` + `deleted_at IS NULL`)
- Sem unicidade de `description` — diferente de `categories`, duas recorrências com a mesma descrição são permitidas (ex: duas faturas de cartão diferentes)
- Recorrência é sempre mensal — sem campo de periodicidade (semanal/anual). Não é uma limitação técnica, é o escopo do MVP; pode virar um change futuro se a necessidade aparecer
- Editar o template (`recurrences`) nunca afeta `monthly_entries` já gerados — é responsabilidade do futuro módulo `monthly-entries` respeitar isso, mas a regra já fica declarada aqui para não ser esquecida
- Uma recorrência só deve gerar lançamento a partir do mês/ano do seu `created_at` em diante — nunca retroativo a meses anteriores à sua criação; também responsabilidade do futuro `monthly-entries`, declarado aqui para não ser esquecido
- Parcelamento (`installments_total` preenchido): quando `installments_generated` atingir `installments_total`, o futuro `monthly-entries` deve desativar a recorrência automaticamente (`active = false`, sem soft delete) — também uma garantia declarada aqui para a implementação futura
- Adicionar `http/recurrences.http` com exemplo de cada endpoint e dos principais erros

## Capabilities

### New Capabilities
- `recurrences`: criação, listagem (com filtro por status e categoria), edição e remoção lógica de recorrências (templates de conta fixa/variável), sempre escopadas ao usuário dono

### Modified Capabilities
_Nenhuma — `categories` e `user-auth` não mudam de comportamento com este change._

## Impact

- **Novo código**: `src/modules/recurrences/` (controller, service, repository, dto, module), `src/database/schema/recurrences.schema.ts`
- **Banco de dados**: nova migration criando a tabela `recurrences` (fk para `users` e `categories`)
- **`app.module.ts`**: registra o novo `RecurrencesModule`
- **Documentação**: novo `http/recurrences.http`
- Não afeta `auth`, `categories` — nenhuma mudança de comportamento nesses módulos
- `monthly-entries`/`transactions` continuam fora de escopo (ainda não existem), mas `monthly-entries` vai depender deste módulo estar pronto

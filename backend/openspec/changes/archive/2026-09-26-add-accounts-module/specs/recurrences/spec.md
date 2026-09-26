## MODIFIED Requirements

### Requirement: Recurrence Creation
O sistema SHALL permitir que um usuário autenticado crie uma recorrência informando `description`, `type` (`'despesa'` ou `'receita'`), `default_amount`, `due_day`, `category_id`, `account_id` e, opcionalmente, `installments_total`, associando-a ao seu próprio `user_id`. O `category_id` informado SHALL pertencer a uma categoria não removida do próprio usuário. O `account_id` informado SHALL pertencer a uma conta não removida do próprio usuário. Quando `installments_total` não for informado, a recorrência SHALL ser criada como indefinida (sem número fixo de ocorrências).

#### Scenario: Successful recurrence creation without installments_total
- **WHEN** um usuário autenticado envia dados válidos, incluindo um `category_id` e um `account_id` de uma categoria e conta próprias não removidas, sem informar `installments_total`
- **THEN** o sistema cria a recorrência vinculada ao usuário, com `active` true, `installments_total` nulo e `installments_generated` igual a zero, e retorna a recorrência criada

#### Scenario: Successful recurrence creation with installments_total
- **WHEN** um usuário autenticado envia dados válidos informando `installments_total` como um inteiro positivo (ex: 12)
- **THEN** o sistema cria a recorrência com `installments_total` igual ao valor informado e `installments_generated` igual a zero

#### Scenario: Creating with a category that does not belong to the user
- **WHEN** um usuário autenticado tenta criar uma recorrência informando um `category_id` que não existe, pertence a outro usuário, ou está removido
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, e nenhuma recorrência é criada

#### Scenario: Creating with an account that does not belong to the user
- **WHEN** um usuário autenticado tenta criar uma recorrência informando um `account_id` que não existe, pertence a outro usuário, ou está removido
- **THEN** o sistema rejeita a requisição como se a conta não existisse, e nenhuma recorrência é criada

### Requirement: Recurrence Listing
O sistema SHALL listar apenas as recorrências não removidas (`deleted_at` nulo) pertencentes ao usuário autenticado, retornando por padrão somente as ativas (`active` true). O sistema SHALL aceitar os parâmetros opcionais `active` (boolean), `categoryId` e `accountId` para refinar o filtro.

#### Scenario: Listing without filters returns only active recurrences
- **WHEN** um usuário autenticado solicita a lista de recorrências sem informar `active`
- **THEN** o sistema retorna somente as recorrências não removidas, ativas, pertencentes ao usuário autenticado

#### Scenario: Listing with active=false returns paused recurrences
- **WHEN** um usuário autenticado solicita a lista de recorrências informando `active=false`
- **THEN** o sistema retorna somente as recorrências não removidas, inativas, pertencentes ao usuário autenticado

#### Scenario: Listing filtered by category
- **WHEN** um usuário autenticado solicita a lista de recorrências informando `categoryId`
- **THEN** o sistema retorna somente as recorrências não removidas do usuário cujo `category_id` corresponde ao valor informado

#### Scenario: Listing filtered by account
- **WHEN** um usuário autenticado solicita a lista de recorrências informando `accountId`
- **THEN** o sistema retorna somente as recorrências não removidas do usuário cujo `account_id` corresponde ao valor informado

### Requirement: Recurrence Editing
O sistema SHALL permitir que um usuário autenticado edite `description`, `category_id`, `account_id`, `type`, `default_amount`, `due_day`, `active` e `installments_total` de uma recorrência própria, não removida.

#### Scenario: Successful recurrence edit
- **WHEN** um usuário autenticado edita uma recorrência que lhe pertence e não está removida, com dados válidos
- **THEN** o sistema atualiza os campos informados e retorna a recorrência atualizada

#### Scenario: Editing to a category that does not belong to the user
- **WHEN** um usuário autenticado tenta editar o `category_id` de uma recorrência sua para uma categoria que não existe, pertence a outro usuário, ou está removida
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, e a recorrência não é alterada

#### Scenario: Editing to an account that does not belong to the user
- **WHEN** um usuário autenticado tenta editar o `account_id` de uma recorrência sua para uma conta que não existe, pertence a outro usuário, ou está removida
- **THEN** o sistema rejeita a requisição como se a conta não existisse, e a recorrência não é alterada

#### Scenario: Editing a recurrence that does not belong to the user
- **WHEN** um usuário autenticado tenta editar uma recorrência pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

#### Scenario: Editing an already-deleted recurrence
- **WHEN** um usuário autenticado tenta editar uma recorrência própria já removida (`deleted_at` preenchido)
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

## Purpose

Permitir que cada usuário cadastre templates de conta fixa/variável ou parcelada (recorrências) — nome, tipo, valor padrão, categoria, dia de vencimento e, opcionalmente, número de parcelas — que servirão de base para a geração automática dos lançamentos mensais, sem precisar recadastrar a mesma conta todo mês.

## ADDED Requirements

### Requirement: Recurrence Creation
O sistema SHALL permitir que um usuário autenticado crie uma recorrência informando `description`, `type` (`'despesa'` ou `'receita'`), `default_amount`, `due_day`, `category_id` e, opcionalmente, `installments_total`, associando-a ao seu próprio `user_id`. O `category_id` informado SHALL pertencer a uma categoria não removida do próprio usuário. Quando `installments_total` não for informado, a recorrência SHALL ser criada como indefinida (sem número fixo de ocorrências).

#### Scenario: Successful recurrence creation without installments_total
- **WHEN** um usuário autenticado envia dados válidos, incluindo um `category_id` de uma categoria própria não removida, sem informar `installments_total`
- **THEN** o sistema cria a recorrência vinculada ao usuário, com `active` true, `installments_total` nulo e `installments_generated` igual a zero, e retorna a recorrência criada

#### Scenario: Successful recurrence creation with installments_total
- **WHEN** um usuário autenticado envia dados válidos informando `installments_total` como um inteiro positivo (ex: 12)
- **THEN** o sistema cria a recorrência com `installments_total` igual ao valor informado e `installments_generated` igual a zero

#### Scenario: Creating with a category that does not belong to the user
- **WHEN** um usuário autenticado tenta criar uma recorrência informando um `category_id` que não existe, pertence a outro usuário, ou está removido
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, e nenhuma recorrência é criada

### Requirement: Recurrence Field Validation
O sistema SHALL exigir que `default_amount` seja um valor inteiro positivo (maior que zero), que `due_day` esteja entre 1 e 31, e que `installments_total`, quando informado, seja um inteiro positivo (maior ou igual a 1) — tudo tanto na criação quanto na edição.

#### Scenario: Rejecting a non-positive default amount
- **WHEN** um usuário autenticado tenta criar ou editar uma recorrência com `default_amount` igual a zero ou negativo
- **THEN** o sistema rejeita a requisição com status 400 e nenhuma alteração é persistida

#### Scenario: Rejecting an out-of-range due day
- **WHEN** um usuário autenticado tenta criar ou editar uma recorrência com `due_day` menor que 1 ou maior que 31
- **THEN** o sistema rejeita a requisição com status 400 e nenhuma alteração é persistida

#### Scenario: Rejecting a non-positive installments_total
- **WHEN** um usuário autenticado tenta criar ou editar uma recorrência com `installments_total` igual a zero ou negativo
- **THEN** o sistema rejeita a requisição com status 400 e nenhuma alteração é persistida

### Requirement: Recurrence Installment Plan
O sistema SHALL manter `installments_generated` como um contador gerido internamente, nunca aceito como entrada do cliente em criação ou edição. O sistema SHALL rejeitar a edição de `installments_total` para um valor menor que o `installments_generated` atual da recorrência.

#### Scenario: Client-provided installments_generated is ignored
- **WHEN** um usuário autenticado envia `installments_generated` no corpo de uma requisição de criação ou edição
- **THEN** o sistema ignora esse campo e mantém o valor gerido internamente, sem erro

#### Scenario: Rejecting a reduction below installments already generated
- **WHEN** um usuário autenticado tenta editar `installments_total` de uma recorrência para um valor menor que o `installments_generated` atual dela
- **THEN** o sistema rejeita a requisição com status 400 e `installments_total` não é alterado

### Requirement: Recurrence Listing
O sistema SHALL listar apenas as recorrências não removidas (`deleted_at` nulo) pertencentes ao usuário autenticado, retornando por padrão somente as ativas (`active` true). O sistema SHALL aceitar os parâmetros opcionais `active` (boolean) e `categoryId` para refinar o filtro.

#### Scenario: Listing without filters returns only active recurrences
- **WHEN** um usuário autenticado solicita a lista de recorrências sem informar `active`
- **THEN** o sistema retorna somente as recorrências não removidas, ativas, pertencentes ao usuário autenticado

#### Scenario: Listing with active=false returns paused recurrences
- **WHEN** um usuário autenticado solicita a lista de recorrências informando `active=false`
- **THEN** o sistema retorna somente as recorrências não removidas, inativas, pertencentes ao usuário autenticado

#### Scenario: Listing filtered by category
- **WHEN** um usuário autenticado solicita a lista de recorrências informando `categoryId`
- **THEN** o sistema retorna somente as recorrências não removidas do usuário cujo `category_id` corresponde ao valor informado

### Requirement: Recurrence Editing
O sistema SHALL permitir que um usuário autenticado edite `description`, `category_id`, `type`, `default_amount`, `due_day`, `active` e `installments_total` de uma recorrência própria, não removida.

#### Scenario: Successful recurrence edit
- **WHEN** um usuário autenticado edita uma recorrência que lhe pertence e não está removida, com dados válidos
- **THEN** o sistema atualiza os campos informados e retorna a recorrência atualizada

#### Scenario: Editing to a category that does not belong to the user
- **WHEN** um usuário autenticado tenta editar o `category_id` de uma recorrência sua para uma categoria que não existe, pertence a outro usuário, ou está removida
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, e a recorrência não é alterada

#### Scenario: Editing a recurrence that does not belong to the user
- **WHEN** um usuário autenticado tenta editar uma recorrência pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

#### Scenario: Editing an already-deleted recurrence
- **WHEN** um usuário autenticado tenta editar uma recorrência própria já removida (`deleted_at` preenchido)
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

### Requirement: Recurrence Soft Delete
O sistema SHALL remover logicamente uma recorrência própria preenchendo `deleted_at` e definindo `active` como `false` na mesma operação, nunca excluindo o registro fisicamente e nunca deixando uma recorrência removida marcada como ativa. O sistema SHALL NOT oferecer uma forma de reverter essa remoção.

#### Scenario: Successful soft delete deactivates the recurrence
- **WHEN** um usuário autenticado remove uma recorrência que lhe pertence e ainda não está removida
- **THEN** o sistema preenche `deleted_at`, define `active` como `false`, e ela deixa de aparecer em listagens futuras, permanecendo no banco para preservar a integridade referencial de lançamentos que já a referenciam

#### Scenario: Deleting a recurrence that does not belong to the user
- **WHEN** um usuário autenticado tenta remover uma recorrência pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

#### Scenario: Deleting an already-deleted recurrence
- **WHEN** um usuário autenticado tenta remover uma recorrência própria já removida
- **THEN** o sistema rejeita a requisição como se a recorrência não existisse

### Requirement: Recurrence Access Requires Authentication
O sistema SHALL exigir um access token válido para criar, listar, editar ou remover recorrências.

#### Scenario: Request without valid access token is rejected
- **WHEN** uma requisição de criação, listagem, edição ou remoção de recorrência é feita sem um access token válido
- **THEN** o sistema rejeita a requisição com status 401 e nenhuma recorrência é criada, alterada ou removida

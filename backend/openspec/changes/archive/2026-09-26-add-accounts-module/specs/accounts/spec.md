## Purpose

Permitir que cada usuário cadastre suas contas de saldo simples (conta corrente, poupança, carteira/dinheiro), servindo de âncora de saldo para recorrências, lançamentos mensais e o histórico de transações, com o saldo atual sempre calculado a partir do saldo inicial e do histórico de transações liquidadas — nunca armazenado como um valor mutável independente.

## ADDED Requirements

### Requirement: Account Creation
O sistema SHALL permitir que um usuário autenticado crie uma conta informando `name` e, opcionalmente, `initialBalance` (inteiro, podendo ser negativo — uma conta pode começar com saldo devedor). Quando `initialBalance` não for informado, SHALL assumir zero.

#### Scenario: Successful account creation with explicit initial balance
- **WHEN** um usuário autenticado cria uma conta informando `name` e `initialBalance`
- **THEN** o sistema cria a conta vinculada ao usuário com o `initialBalance` informado

#### Scenario: Successful account creation with default initial balance
- **WHEN** um usuário autenticado cria uma conta informando apenas `name`
- **THEN** o sistema cria a conta com `initialBalance` igual a zero

#### Scenario: Successful account creation with negative initial balance
- **WHEN** um usuário autenticado cria uma conta informando um `initialBalance` negativo
- **THEN** o sistema cria a conta normalmente, sem rejeitar o valor negativo

### Requirement: Account Listing With Derived Balance
O sistema SHALL listar apenas as contas não removidas (`deleted_at` nulo) pertencentes ao usuário autenticado, cada uma incluindo um `currentBalance` calculado como `initialBalance` somado ao total de `transactions` liquidadas daquela conta (receitas somadas, despesas subtraídas). O sistema SHALL NUNCA persistir `currentBalance` como um campo próprio da conta.

#### Scenario: Listing returns accounts with computed current balance
- **WHEN** um usuário autenticado solicita a lista de contas, e uma delas tem `initialBalance` de 10000 e transações liquidadas somando +5000 em receitas e -2000 em despesas
- **THEN** o sistema retorna essa conta com `currentBalance` igual a 13000

#### Scenario: Listing returns only own, non-deleted accounts
- **WHEN** um usuário autenticado solicita a lista de contas
- **THEN** o sistema retorna somente as contas não removidas cujo dono é o usuário autenticado

### Requirement: Account Editing
O sistema SHALL permitir que um usuário autenticado edite `name` e/ou `initialBalance` de uma conta própria, não removida.

#### Scenario: Successful account edit
- **WHEN** um usuário autenticado edita `name` e/ou `initialBalance` de uma conta que lhe pertence e não está removida
- **THEN** o sistema atualiza os campos informados e retorna a conta atualizada, com `currentBalance` recalculado a partir do novo `initialBalance`

#### Scenario: Editing an account that does not belong to the user
- **WHEN** um usuário autenticado tenta editar uma conta pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a conta não existisse

#### Scenario: Editing an already-deleted account
- **WHEN** um usuário autenticado tenta editar uma conta própria já removida
- **THEN** o sistema rejeita a requisição como se a conta não existisse

### Requirement: Account Soft Delete
O sistema SHALL remover logicamente uma conta própria preenchendo `deleted_at`, nunca excluindo o registro fisicamente. O sistema SHALL NOT oferecer uma forma de reverter essa remoção, e SHALL NOT bloquear a remoção de uma conta referenciada por recorrências, lançamentos ou transações existentes.

#### Scenario: Successful soft delete
- **WHEN** um usuário autenticado remove uma conta que lhe pertence e ainda não está removida
- **THEN** o sistema preenche `deleted_at` e ela deixa de aparecer em listagens futuras, permanecendo no banco para preservar a integridade referencial de registros que já a referenciam

#### Scenario: Deleting an account that does not belong to the user
- **WHEN** um usuário autenticado tenta remover uma conta pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a conta não existisse

#### Scenario: Deleting an already-deleted account
- **WHEN** um usuário autenticado tenta remover uma conta própria já removida
- **THEN** o sistema rejeita a requisição como se a conta não existisse

### Requirement: Account Access Requires Authentication
O sistema SHALL exigir um access token válido para criar, listar, editar ou remover contas.

#### Scenario: Request without valid access token is rejected
- **WHEN** uma requisição de criação, listagem, edição ou remoção de conta é feita sem um access token válido
- **THEN** o sistema rejeita a requisição com status 401 e nenhuma conta é criada, alterada ou removida

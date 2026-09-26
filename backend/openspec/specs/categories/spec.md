# categories Specification

## Purpose
Permitir que cada usuário classifique seus lançamentos financeiros (recorrências e lançamentos avulsos) em categorias próprias, criadas, listadas, editadas e removidas logicamente por ele mesmo.

## Requirements

### Requirement: Category Creation
O sistema SHALL permitir que um usuário autenticado crie uma categoria informando um `name`, associando-a ao seu próprio `user_id`.

#### Scenario: Successful category creation
- **WHEN** um usuário autenticado envia um `name` válido para criar uma categoria
- **THEN** o sistema cria a categoria vinculada ao usuário autenticado e retorna a categoria criada

### Requirement: Category Listing
O sistema SHALL listar apenas as categorias não removidas (`deleted_at` nulo) pertencentes ao usuário autenticado. O sistema SHALL aceitar um parâmetro de busca opcional `name` para filtrar o resultado por categorias cujo `name` contenha o valor informado, sem diferenciar maiúsculas/minúsculas. Quando `name` for informado, SHALL ter no mínimo 3 caracteres.

#### Scenario: Listing returns only own, non-deleted categories
- **WHEN** um usuário autenticado solicita a lista de categorias sem informar `name`
- **THEN** o sistema retorna somente as categorias com `deleted_at` nulo cujo `user_id` é o do usuário autenticado, sem incluir categorias de outros usuários nem categorias removidas

#### Scenario: Filtering by name returns partial, case-insensitive matches
- **WHEN** um usuário autenticado solicita a lista de categorias informando `name` com 3 ou mais caracteres
- **THEN** o sistema retorna somente as categorias não removidas do usuário cujo `name` contém o valor informado, sem diferenciar maiúsculas/minúsculas

#### Scenario: Filtering with fewer than 3 characters is rejected
- **WHEN** um usuário autenticado solicita a lista de categorias informando `name` com menos de 3 caracteres
- **THEN** o sistema rejeita a requisição com status 400 e nenhuma lista é retornada

#### Scenario: Filtering with no matches returns an empty list
- **WHEN** um usuário autenticado informa `name` com 3 ou mais caracteres e nenhuma categoria não removida sua contém esse valor
- **THEN** o sistema retorna uma lista vazia, não um erro

### Requirement: Category Editing
O sistema SHALL permitir que um usuário autenticado edite o `name` de uma categoria própria, não removida.

#### Scenario: Successful category name edit
- **WHEN** um usuário autenticado edita o `name` de uma categoria que lhe pertence e não está removida
- **THEN** o sistema atualiza o `name` da categoria e retorna a categoria atualizada

#### Scenario: Editing a category that does not belong to the user
- **WHEN** um usuário autenticado tenta editar uma categoria pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, sem revelar que ela pertence a outro usuário

#### Scenario: Editing an already-deleted category
- **WHEN** um usuário autenticado tenta editar uma categoria própria já removida (`deleted_at` preenchido)
- **THEN** o sistema rejeita a requisição como se a categoria não existisse

### Requirement: Category Name Uniqueness Per User
O sistema SHALL impedir que um usuário tenha duas categorias não removidas com o mesmo `name` (comparação sem diferenciar maiúsculas/minúsculas), tanto na criação quanto na edição. Essa restrição é isolada por usuário — usuários diferentes podem ter categorias com o mesmo nome.

#### Scenario: Creating a category with a name already in use
- **WHEN** um usuário autenticado tenta criar uma categoria com um `name` que já existe (comparação sem diferenciar maiúsculas/minúsculas) em outra categoria não removida sua
- **THEN** o sistema rejeita a requisição com status 409 e nenhuma categoria nova é criada

#### Scenario: Renaming a category to a name already in use
- **WHEN** um usuário autenticado tenta editar o `name` de uma categoria sua para um valor que já existe (comparação sem diferenciar maiúsculas/minúsculas) em outra categoria não removida sua
- **THEN** o sistema rejeita a requisição com status 409 e o `name` da categoria não é alterado

#### Scenario: Renaming a category to its own current name
- **WHEN** um usuário autenticado edita uma categoria sua enviando o mesmo `name` que ela já possui
- **THEN** o sistema aceita a requisição normalmente, sem tratar como conflito consigo mesma

#### Scenario: Reusing the name of a previously deleted category
- **WHEN** um usuário autenticado cria ou renomeia uma categoria para um `name` que só existe em uma categoria sua já removida (`deleted_at` preenchido)
- **THEN** o sistema aceita a requisição normalmente, pois categorias removidas não contam para a checagem de duplicidade

### Requirement: Category Soft Delete
O sistema SHALL remover logicamente uma categoria própria preenchendo `deleted_at`, nunca excluindo o registro fisicamente.

#### Scenario: Successful soft delete
- **WHEN** um usuário autenticado remove uma categoria que lhe pertence e ainda não está removida
- **THEN** o sistema preenche `deleted_at` da categoria e ela deixa de aparecer em listagens futuras, permanecendo no banco para preservar a integridade referencial de lançamentos que já a referenciam

#### Scenario: Deleting a category that does not belong to the user
- **WHEN** um usuário autenticado tenta remover uma categoria pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se a categoria não existisse

#### Scenario: Deleting an already-deleted category
- **WHEN** um usuário autenticado tenta remover uma categoria própria já removida
- **THEN** o sistema rejeita a requisição como se a categoria não existisse

### Requirement: Category Access Requires Authentication
O sistema SHALL exigir um access token válido para criar, listar, editar ou remover categorias.

#### Scenario: Request without valid access token is rejected
- **WHEN** uma requisição de criação, listagem, edição ou remoção de categoria é feita sem um access token válido
- **THEN** o sistema rejeita a requisição com status 401 e nenhuma categoria é criada, alterada ou removida

## MODIFIED Requirements

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

## Purpose

Dar ao usuário a visão do que precisa pagar/receber em cada mês, gerando automaticamente os lançamentos a partir das recorrências ativas, permitindo lançamentos avulsos, e sincronizando a marcação de pago/recebido com um histórico definitivo de transações.

## ADDED Requirements

### Requirement: Monthly Entry Generation
O sistema SHALL, ao consultar os lançamentos de um mês/ano atual ou passado para o usuário autenticado, gerar sob demanda um `monthly_entry` para cada recorrência do usuário que esteja ativa, não removida, cujo `created_at` corresponda a um mês/ano igual ou anterior ao consultado, e que **ainda não tenha** um `monthly_entry` gerado para aquele mês/ano especificamente — a geração é avaliada recorrência a recorrência, não em lote por mês. O `due_date` gerado SHALL usar o `due_day` da recorrência, ajustado para o último dia do mês quando o mês consultado tiver menos dias que `due_day`.

#### Scenario: First-time generation for a month
- **WHEN** um usuário autenticado consulta um mês/ano atual ou passado pela primeira vez
- **THEN** o sistema cria um `monthly_entry` para cada recorrência ativa e elegível do usuário, copiando `category_id`, `account_id`, `description`, `type` e usando `default_amount` como `amount`, com `status` `'pendente'`

#### Scenario: Generation does not duplicate an already-generated recurrence
- **WHEN** um usuário autenticado consulta novamente um mês/ano em que uma recorrência específica já teve seu lançamento gerado
- **THEN** o sistema não cria um segundo lançamento para essa recorrência naquele mês, apenas retorna o já existente

#### Scenario: A recurrence created after the month was first queried still generates on a later query
- **WHEN** um usuário autenticado cadastra uma nova recorrência elegível para um mês/ano que já teve lançamentos de outras recorrências gerados anteriormente, e consulta esse mês/ano novamente
- **THEN** o sistema gera o lançamento da recorrência nova normalmente, sem que a existência de lançamentos de outras recorrências naquele mês impeça isso

#### Scenario: Recurrences created after the queried month are skipped
- **WHEN** a geração ocorre para um mês/ano anterior ao mês/ano de criação de uma recorrência do usuário
- **THEN** o sistema não gera lançamento para essa recorrência naquele mês

#### Scenario: Inactive recurrences are skipped
- **WHEN** a geração ocorre e uma recorrência do usuário está com `active` `false` no momento da consulta
- **THEN** o sistema não gera lançamento para essa recorrência

#### Scenario: Due day is clamped to the last day of a shorter month
- **WHEN** a geração ocorre para um mês com menos dias que o `due_day` de uma recorrência elegível (ex: `due_day` 31 em fevereiro)
- **THEN** o sistema cria o lançamento com `due_date` no último dia daquele mês

### Requirement: Monthly Entry Preview for Future Periods
O sistema SHALL, ao consultar um mês/ano posterior ao mês/ano atual do servidor, retornar uma prévia calculada do que seria gerado (recorrências elegíveis, com as mesmas regras de elegibilidade da geração normal) combinada com os lançamentos avulsos reais já cadastrados para aquele período, sem persistir nenhum `monthly_entry` de recorrência nem mutar `installments_generated`/`active` de nenhuma recorrência.

#### Scenario: Previewing a future month with eligible recurrences
- **WHEN** um usuário autenticado consulta um mês/ano futuro
- **THEN** o sistema retorna os lançamentos que seriam gerados pelas recorrências elegíveis, sem `id` e sem gravar nada no banco, junto dos lançamentos avulsos reais já cadastrados para aquele mês/ano

#### Scenario: Previewed entries cannot be acted upon
- **WHEN** a resposta de uma consulta a um mês futuro inclui um lançamento de prévia (não persistido)
- **THEN** esse item não possui um `id` que permita chamadas de edição, exclusão, liquidação ou skip

### Requirement: Ad-hoc Entry Creation
O sistema SHALL permitir que um usuário autenticado crie um lançamento avulso (sem `recurrence_id`) informando `description`, `category_id`, `account_id`, `type`, `amount` e `due_date`. O `month` e o `year` do lançamento SHALL ser sempre derivados do `due_date` informado.

#### Scenario: Successful ad-hoc entry creation
- **WHEN** um usuário autenticado cria um lançamento avulso com dados válidos, incluindo um `category_id` e um `account_id` de uma categoria e conta próprias não removidas
- **THEN** o sistema cria o lançamento com `recurrence_id` nulo, `status` `'pendente'`, e `month`/`year` calculados a partir do `due_date` informado

#### Scenario: Creating with a category that does not belong to the user
- **WHEN** um usuário autenticado tenta criar um lançamento avulso informando um `category_id` que não existe, pertence a outro usuário, ou está removido
- **THEN** o sistema rejeita a requisição como se a categoria não existisse, e nenhum lançamento é criado

#### Scenario: Creating with an account that does not belong to the user
- **WHEN** um usuário autenticado tenta criar um lançamento avulso informando um `account_id` que não existe, pertence a outro usuário, ou está removido
- **THEN** o sistema rejeita a requisição como se a conta não existisse, e nenhum lançamento é criado

### Requirement: Monthly Entry Editing
O sistema SHALL permitir que um usuário autenticado edite `amount`, `description`, `category_id`, `account_id` e `due_date` de um lançamento próprio. O `due_date` editado SHALL permanecer dentro do mesmo `month`/`year` do lançamento. O campo `type` SHALL só ser editável em lançamentos sem `recurrence_id` (avulsos).

#### Scenario: Successful edit of an ad-hoc entry, including type
- **WHEN** um usuário autenticado edita `amount`, `description`, `category_id`, `account_id`, `due_date` ou `type` de um lançamento avulso seu
- **THEN** o sistema atualiza os campos informados e retorna o lançamento atualizado

#### Scenario: Successful edit of a recurrence-linked entry, excluding type
- **WHEN** um usuário autenticado edita `amount`, `description`, `category_id`, `account_id` ou `due_date` de um lançamento seu vinculado a uma recorrência
- **THEN** o sistema atualiza os campos informados sem alterar o template da recorrência

#### Scenario: Editing to an account that does not belong to the user
- **WHEN** um usuário autenticado tenta editar o `account_id` de um lançamento seu para uma conta que não existe, pertence a outro usuário, ou está removida
- **THEN** o sistema rejeita a requisição como se a conta não existisse, e o lançamento não é alterado

#### Scenario: Editing type of a recurrence-linked entry is rejected
- **WHEN** um usuário autenticado tenta editar `type` de um lançamento seu vinculado a uma recorrência
- **THEN** o sistema rejeita a requisição com status 400 e nenhum campo é alterado

#### Scenario: Editing due_date outside the entry's month is rejected
- **WHEN** um usuário autenticado tenta editar `due_date` de um lançamento seu para uma data fora do `month`/`year` atual do lançamento
- **THEN** o sistema rejeita a requisição com status 400 e nenhum campo é alterado

#### Scenario: Editing an already-settled entry syncs the linked transaction
- **WHEN** um usuário autenticado edita `amount`, `description`, `category_id` ou `account_id` de um lançamento seu que já está `status` `'liquidado'`
- **THEN** o sistema atualiza o lançamento e também a `transaction` vinculada com os mesmos valores

#### Scenario: Editing an entry that does not belong to the user
- **WHEN** um usuário autenticado tenta editar um lançamento pertencente a outro usuário
- **THEN** o sistema rejeita a requisição como se o lançamento não existisse

### Requirement: Monthly Entry Deletion Is Restricted to Unsettled Ad-hoc Entries
O sistema SHALL permitir excluir apenas lançamentos avulsos (sem `recurrence_id`) que ainda não estejam liquidados (sem `transaction_id`).

#### Scenario: Successful deletion of an unsettled ad-hoc entry
- **WHEN** um usuário autenticado exclui um lançamento avulso seu que ainda não foi liquidado
- **THEN** o sistema remove o lançamento permanentemente

#### Scenario: Deleting a recurrence-linked entry is rejected
- **WHEN** um usuário autenticado tenta excluir um lançamento seu vinculado a uma recorrência
- **THEN** o sistema rejeita a requisição com status 409 e o lançamento não é removido — para não contabilizar aquele mês específico sem afetar a recorrência inteira, o usuário deve usar a ação de pular (skip) em vez de excluir

#### Scenario: Deleting a settled entry is rejected
- **WHEN** um usuário autenticado tenta excluir um lançamento avulso seu que já está liquidado
- **THEN** o sistema rejeita a requisição com status 409 e o lançamento não é removido, exigindo desfazer a liquidação primeiro

### Requirement: Settling a Monthly Entry
O sistema SHALL permitir que um usuário autenticado marque um lançamento próprio, ainda não liquidado, como liquidado (pago, se for despesa, ou recebido, se for receita), criando uma `transaction` com os dados do lançamento (`category_id`, `account_id`, `description`, `type`, `amount`) e um `settled_at` opcionalmente informado pelo usuário (padrão: o momento da requisição).

#### Scenario: Successful settlement
- **WHEN** um usuário autenticado liquida um lançamento seu que está `'pendente'`
- **THEN** o sistema cria uma `transaction` com os dados do lançamento, preenche `transaction_id` no lançamento e define `status` `'liquidado'`

#### Scenario: Successful settlement with a backdated settled_at
- **WHEN** um usuário autenticado liquida um lançamento informando um `settledAt` no passado
- **THEN** a `transaction` criada usa o `settledAt` informado em vez do momento atual

#### Scenario: Settling an already-settled entry is rejected
- **WHEN** um usuário autenticado tenta liquidar um lançamento seu que já está `'liquidado'`
- **THEN** o sistema rejeita a requisição com status 409 e nenhuma nova `transaction` é criada

#### Scenario: Settling a skipped entry is rejected
- **WHEN** um usuário autenticado tenta liquidar um lançamento seu que está `'pulado'`
- **THEN** o sistema rejeita a requisição com status 409 e nenhuma nova `transaction` é criada

### Requirement: Unsettling a Monthly Entry
O sistema SHALL permitir que um usuário autenticado desfaça a liquidação de um lançamento próprio atualmente liquidado, removendo a `transaction` vinculada e retornando o lançamento a `'pendente'`.

#### Scenario: Successful unsettlement
- **WHEN** um usuário autenticado desfaz a liquidação de um lançamento seu que está `'liquidado'`
- **THEN** o sistema remove a `transaction` vinculada, limpa `transaction_id` e define `status` `'pendente'`

#### Scenario: Unsettling an entry that is not settled is rejected
- **WHEN** um usuário autenticado tenta desfazer a liquidação de um lançamento seu que já está `'pendente'`
- **THEN** o sistema rejeita a requisição com status 409

### Requirement: Skipping a Recurrence-Linked Entry
O sistema SHALL permitir que um usuário autenticado marque um lançamento próprio, vinculado a uma recorrência e `'pendente'`, como `'pulado'`, sem afetar a recorrência ou seus outros lançamentos. O sistema SHALL permitir desfazer isso, retornando o lançamento a `'pendente'`. Um lançamento `'pulado'` SHALL contar para `installments_generated`/`installment_number` da mesma forma que um gerado normalmente (o contador não é revertido).

#### Scenario: Successful skip
- **WHEN** um usuário autenticado pula um lançamento seu vinculado a uma recorrência que está `'pendente'`
- **THEN** o sistema define `status` como `'pulado'` no lançamento, sem alterar a recorrência

#### Scenario: Skipping an ad-hoc entry is rejected
- **WHEN** um usuário autenticado tenta pular um lançamento avulso seu (sem `recurrence_id`)
- **THEN** o sistema rejeita a requisição com status 400

#### Scenario: Skipping an entry that is not pending is rejected
- **WHEN** um usuário autenticado tenta pular um lançamento seu que já está `'liquidado'` ou já `'pulado'`
- **THEN** o sistema rejeita a requisição com status 409

#### Scenario: Successful unskip
- **WHEN** um usuário autenticado desfaz o skip de um lançamento seu que está `'pulado'`
- **THEN** o sistema define `status` como `'pendente'` no lançamento

#### Scenario: Unskipping an entry that is not skipped is rejected
- **WHEN** um usuário autenticado tenta desfazer o skip de um lançamento seu que não está `'pulado'`
- **THEN** o sistema rejeita a requisição com status 409

### Requirement: Overdue Status Is Always Derived
O sistema SHALL nunca persistir um status "atrasado" — todo lançamento retornado pela API SHALL incluir um indicador calculado em tempo de leitura, verdadeiro apenas quando `status` for `'pendente'` e `due_date` for anterior à data atual.

#### Scenario: Pending entry past its due date is flagged as overdue
- **WHEN** um lançamento `'pendente'` tem `due_date` anterior à data atual e é retornado numa consulta
- **THEN** o sistema inclui o indicador de atraso como verdadeiro na resposta, sem alterar o `status` armazenado

#### Scenario: Settled entry is never flagged as overdue
- **WHEN** um lançamento `'liquidado'` tem `due_date` anterior à data atual e é retornado numa consulta
- **THEN** o sistema inclui o indicador de atraso como falso

#### Scenario: Skipped entry is never flagged as overdue
- **WHEN** um lançamento `'pulado'` tem `due_date` anterior à data atual e é retornado numa consulta
- **THEN** o sistema inclui o indicador de atraso como falso

### Requirement: Installment Tracking on Generation
O sistema SHALL, ao gerar um lançamento para uma recorrência com `installments_total` preenchido, gravar em `installment_number` o valor de `installments_generated + 1` da recorrência no momento da geração, e incrementar `installments_generated` da recorrência na mesma operação. Ao atingir `installments_generated == installments_total`, o sistema SHALL desativar a recorrência (`active = false`).

#### Scenario: Generating an installment records its snapshot number
- **WHEN** o sistema gera um lançamento para uma recorrência parcelada com `installments_generated` igual a 3 e `installments_total` igual a 12
- **THEN** o lançamento criado tem `installment_number` igual a 4, e a recorrência passa a ter `installments_generated` igual a 4

#### Scenario: Reaching the total installments deactivates the recurrence
- **WHEN** a geração de um lançamento faz `installments_generated` da recorrência atingir seu `installments_total`
- **THEN** o sistema define `active` como `false` na recorrência, sem preencher `deleted_at`

#### Scenario: Raising installments_total after auto-deactivation does not reactivate automatically
- **WHEN** um usuário autenticado aumenta o `installments_total` de uma recorrência que já foi desativada automaticamente por ter esgotado as parcelas
- **THEN** a recorrência permanece com `active` `false` até que o usuário explicitamente a reative

### Requirement: Monthly Entry Access Requires Authentication
O sistema SHALL exigir um access token válido para consultar, criar, editar, excluir, liquidar, desfazer liquidação, pular ou desfazer skip de lançamentos mensais.

#### Scenario: Request without valid access token is rejected
- **WHEN** uma requisição de consulta, criação, edição, exclusão, liquidação, desfazimento de liquidação, skip ou unskip é feita sem um access token válido
- **THEN** o sistema rejeita a requisição com status 401 e nenhum dado é criado, alterado ou removido

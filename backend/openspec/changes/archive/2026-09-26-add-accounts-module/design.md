## Context

`categories` e `recurrences` já estabeleceram o padrão de módulo de domínio com ownership cross-módulo (`findOwnedById`). `accounts` segue o mesmo padrão, mas é o primeiro caso em que uma coluna nova precisa ser **obrigatória** em tabelas que já têm dados — exige migração de dados, não só de schema. Ver proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Definir como o saldo é calculado (derivado, nunca armazenado)
- Definir a migração de dados que torna `account_id` obrigatório sem quebrar registros existentes
- Definir como a validação de ownership de `account_id` se replica pelo mesmo padrão já usado pra `category_id`

**Non-Goals:**
- Não cobre cartão de crédito (fatura, fechamento, limite) — fica pra um change futuro
- Não cobre transferência entre contas — não é uma operação modelada aqui, só entrada/saída via `transactions`
- Não cobre a previsão de caixa em si — esse é o próximo change, que consome `accounts` mas não é definido aqui

## Decisions

### Saldo sempre derivado, nunca um campo armazenado
`accounts.initial_balance` é o único valor gravado; `currentBalance` é calculado em toda listagem: `initial_balance + SUM(transactions.amount WHERE type='receita' AND account_id=:id) - SUM(transactions.amount WHERE type='despesa' AND account_id=:id)`.
- **Alternativa considerada**: campo `current_balance` mutável, atualizado a cada `settle`/`unsettle`/edição de transaction. Rejeitada — exigiria manter esse campo sincronizado em múltiplos pontos do código (`MonthlyEntriesService.settle`, `.unsettle`, `.update` quando edita valor de lançamento já liquidado), com risco real de um desses pontos esquecer de atualizar e o saldo dessincronizar do histórico real. Derivado é sempre consistente por construção — a fonte de verdade é só uma (`transactions`).
- Único ponto de atenção de performance: a query de listagem de contas faz um agregado por conta. Aceitável no volume de um usuário só; se crescer, um índice em `transactions (account_id, type)` resolveria sem mudar a abordagem.

### `account_id` obrigatório: migração de dados antes da constraint
Como `recurrences`, `monthly_entries` e `transactions` já têm dados sem conta, a migration segue esta ordem:
1. Adicionar `account_id` como coluna **nullable** nas 3 tabelas
2. Para cada usuário existente, criar uma conta `"Conta Padrão"` (`initial_balance = 0`)
3. `UPDATE` em `recurrences`/`monthly_entries`/`transactions` preenchendo `account_id` com a conta padrão do respectivo `user_id`
4. Alterar a coluna pra `NOT NULL` nas 3 tabelas
- **Alternativa considerada**: manter `account_id` nullable indefinidamente e só exigir em registros novos. Rejeitada explicitamente pelo usuário — a obrigatoriedade uniforme simplifica a futura previsão de caixa (nunca precisa tratar "lançamento sem conta" como caso especial).
- Criar uma conta padrão por usuário (em vez de pedir pro usuário escolher/criar manualmente antes de migrar) evita quebrar a aplicação pra quem já tem dados — o usuário pode renomear ou consolidar essa conta depois normalmente, via `PATCH`.

### Validação de `account_id` reaproveitando o padrão de `category_id`
`RecurrencesService`/`MonthlyEntriesService` consultam `AccountsRepository.findOwnedById(accountId, userId)` antes de criar/editar, mesmo padrão já usado com `CategoriesRepository`. `AccountsModule` exporta `AccountsRepository`; `RecurrencesModule` e `MonthlyEntriesModule` passam a importar `AccountsModule` também.

### `monthly_entries.account_id`: copiado da recorrência na geração, obrigatório no avulso
Igual ao `category_id` hoje: ao gerar um lançamento a partir de uma recorrência, `account_id` é copiado dela; ao criar um avulso, o cliente informa `accountId` (validado por ownership). Editável depois como qualquer outro campo do lançamento.

### `transactions.account_id`: copiado do `monthly_entry` no `settle`
Mesma lógica de `category_id`/`description`/`type`/`amount` já copiados hoje — `account_id` entra na mesma cópia, sem lógica nova no fluxo de `settle`.

### Sem checagem de uso ao deletar conta
Mesma decisão já tomada pra `categories`: soft delete de uma conta não verifica se há recorrências/lançamentos apontando pra ela. Consistente, e evita a complexidade de "forçar reatribuição" antes de deletar.

## Risks / Trade-offs

- **Conta "Padrão" criada automaticamente pode confundir o usuário** ("de onde veio essa conta?") — mitigação: aceitável, é um artefato de migração visível e editável; o usuário pode renomear ou não usar mais.
- **Cálculo de saldo agregado em toda listagem de contas** → custo de leitura maior que um campo direto. Mitigação: aceitável no volume atual; índice composto resolve se necessário no futuro.
- **`monthly-entries` ainda é um change aberto** → em vez de um delta "Modified" formal (que só se aplica a specs já arquivadas), a integração de `account_id` nele é feita por edição direta do change existente, coordenada com este. Registrado aqui pra rastreabilidade.

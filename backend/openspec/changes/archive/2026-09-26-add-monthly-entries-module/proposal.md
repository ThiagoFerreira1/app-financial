## Why

É o módulo central do MVP (requirements #3, #4 e #5 do CLAUDE.md): visão do mês, marcar como pago/recebido, e lançamento avulso. Sem ele, `categories` e `recurrences` são só cadastro — não existe "o app" de fato, que é ver o que precisa pagar/receber num mês e ir marcando conforme acontece.

## What Changes

- Criar a tabela `monthly_entries` (instância mensal de um lançamento — gerado a partir de uma recorrência ou avulso) e `transactions` (histórico definitivo do que foi realmente pago/recebido), incluindo `CHECK` de `type`/`status` já na migration inicial (pagando a dívida técnica documentada no CLAUDE.md sobre não ter constraint de banco nesses campos)
- `GET /v1/monthly-entries?month=X&year=Y` — geração on-demand **idempotente por recorrência** (via índice único, não uma checagem em lote do mês inteiro): cada recorrência ativa e elegível que ainda não tem lançamento para aquele mês gera o seu, independente de outras recorrências já terem gerado antes — inclui o campo calculado `isOverdue` (nunca persistido)
  - Mês/ano **futuro**: não gera nem persiste nada; retorna uma **prévia calculada em memória** do que seria gerado (recorrências elegíveis + lançamentos avulsos reais já cadastrados pra aquele mês), marcada como não-persistida (sem `id`); a prévia assume que nada muda entre agora e o mês consultado
  - Recorrências só geram a partir do mês/ano do seu `created_at` (nunca retroativo a antes de existirem)
  - `active` é checado no momento da geração (estado atual) — sem reconstrução histórica de quando a recorrência esteve ativa; aceito como limitação conhecida
- `POST /v1/monthly-entries` — cria lançamento avulso (`recurrence_id` nulo); exige `account_id` (validado por ownership, mesmo padrão de `category_id`); `month`/`year` sempre derivados do `due_date` informado, nunca aceitos como campos separados; `due_date` pode ser em qualquer mês, inclusive futuro
- `PATCH /v1/monthly-entries/:id` — edita `amount`, `description`, `category_id`, `account_id`, `due_date` de um lançamento próprio; `due_date` só pode mudar dentro do mesmo `month`/`year` do lançamento (não pode "mudar de mês"); `type` só é editável em lançamentos avulsos (sem `recurrence_id`) — tentar editar `type` de um lançamento vinculado a recorrência é rejeitado; editar um lançamento já liquidado é permitido e sincroniza a `transaction` vinculada (incluindo `account_id`)
- `DELETE /v1/monthly-entries/:id` — só permite excluir lançamentos avulsos; lançamentos vinculados a uma recorrência não podem ser excluídos (rejeitado com 409, use `skip` para isso) — um avulso já liquidado (com `transaction_id`) também não pode ser excluído diretamente — precisa desfazer a liquidação primeiro
- `POST /v1/monthly-entries/:id/settle` — marca como liquidado (pago ou recebido, conforme o `type`): cria a `transaction` (copiando `category_id`/`account_id`/`description`/`type`/`amount`), preenche `transaction_id` e `status = 'liquidado'`; aceita `settledAt` opcional no body (default: agora); rejeitado se já `'liquidado'` ou `'pulado'`
- `POST /v1/monthly-entries/:id/unsettle` — desfaz a liquidação: apaga a `transaction` vinculada, limpa `transaction_id`, volta `status = 'pendente'`
- `POST /v1/monthly-entries/:id/skip` — pula um mês específico de uma recorrência sem pausar a recorrência inteira: define `status = 'pulado'` num lançamento vinculado a recorrência, `'pendente'`. Um lançamento pulado não conta como "a pagar/receber", nunca é "atrasado", e não pode ser liquidado enquanto pulado. Não decrementa `installments_generated`/`installment_number` de uma recorrência parcelada — a parcela já contou, só não vai ser liquidada
- `POST /v1/monthly-entries/:id/unskip` — desfaz o skip, volta `status = 'pendente'`
- Parcelas: ao gerar o lançamento de uma recorrência com `installments_total` preenchido, grava `installment_number` (snapshot, `installments_generated + 1` no momento da geração) e incrementa `installments_generated` da recorrência; ao atingir `installments_total`, desativa a recorrência (`active = false`) automaticamente — que **não** é revertido sozinho se o usuário depois aumentar `installments_total` (precisa reativar manualmente)
- `transactions` não ganha controller próprio — só é criada/removida internamente pelas ações de settle/unsettle
- **Emenda coordenada com o change `add-accounts-module`**: `monthly_entries` e `transactions` ganham `account_id` obrigatório (fk -> `accounts`), seguindo exatamente o mesmo padrão de `category_id` (ownership validado via `AccountsRepository.findOwnedById`, copiado da recorrência na geração, copiado do `monthly_entry` pra `transaction` no `settle`)

## Capabilities

### New Capabilities
- `monthly-entries`: geração on-demand dos lançamentos do mês a partir das recorrências ativas, lançamentos avulsos, marcação de pago/recebido com sincronização para o histórico de transações, e status "atrasado" sempre derivado

### Modified Capabilities
- `recurrences`: nenhum requirement muda de texto, mas o comportamento de `installments_generated`/`active` (hoje só geridos manualmente/por padrão do banco) passa a ser mutado por este módulo — sem mudança de contrato de API de `recurrences` em si

## Impact

- **Novo código**: `src/modules/monthly-entries/` (controller, service, repository, dto, module), `src/modules/transactions/` (só repository, sem controller — usado internamente por `monthly-entries`), `src/database/schema/monthly-entries.schema.ts`, `src/database/schema/transactions.schema.ts`
- **Banco de dados**: nova migration criando `monthly_entries` e `transactions`, com `CHECK` de `type`/`status` e índice único parcial `(recurrence_id, month, year) WHERE recurrence_id IS NOT NULL`
- **`app.module.ts`**: registra `MonthlyEntriesModule` (que importa `RecurrencesModule`/`CategoriesModule` para ownership cross-módulo)
- **Documentação**: novo `http/monthly-entries.http`
- Não afeta `auth`, `categories` — nenhuma mudança de comportamento nesses módulos
- `recurrences` ganha consumidor real dos campos `active`/`installments_generated`, que até agora só existiam no schema sem nada os mutando automaticamente

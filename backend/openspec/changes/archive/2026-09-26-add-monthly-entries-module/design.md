## Context

`categories` e `recurrences` já estão prontos. Este change consome ambos e finalmente dá uso real aos campos `active`/`installments_total`/`installments_generated` de `recurrences`, que até agora só existiam no schema sem nada os mutando. Ver proposal.md - Why. As decisões abaixo resolvem os 12 gaps levantados antes de especificar este change, com paralelos de sistemas de produção (Stripe Billing/Invoicing, modelo de exceções de eventos recorrentes do Google Calendar, YNAB/Mint) usados como referência.

## Goals / Non-Goals

**Goals:**
- Definir o algoritmo exato de geração on-demand (quando gera, o que pula, idempotência)
- Definir quais campos são editáveis em cada tipo de lançamento (avulso vs. vinculado a recorrência) e as restrições de `due_date`/`type`
- Definir o modelo de exclusão (por que só avulso, por que não paga)
- Definir os endpoints de ação `settle`/`unsettle`/`skip`/`unskip` e sua sincronização com `transactions`/`recurrences`
- Definir como funciona a prévia (não persistida) de meses futuros
- Fechar as 3 garantias que ficaram declarativas no design de `recurrences` (vigência, auto-desativação, `installment_number`)

**Non-Goals:**
- Não cobre reconstrução histórica de quando uma recorrência esteve ativa (sem event log) — aceita a limitação de usar o estado atual
- Não cobre relatórios/gráficos — fora do MVP (CLAUDE.md seção 5.1)
- Não cobre reajuste automático do cronograma de parcelas quando uma é pulada (`skip` não "empurra" a parcela pra frente, só marca aquele mês como não liquidado)

## Decisions

### Geração on-demand: idempotência por recorrência via índice único, não checagem em lote
**Isto contraria a leitura literal do algoritmo descrito no CLAUDE.md** (seção 5.2, que fala em "verificar se já existem `monthly_entries` para aquele `user_id`/`month`/`year`" como um único check em lote) — decisão revista e confirmada explicitamente com o usuário durante a especificação deste change, pelos motivos abaixo.

Ao consultar `GET /monthly-entries?month=X&year=Y`, o sistema **não** faz mais um único SELECT "existe algo neste mês?" antes de decidir gerar. Em vez disso, para cada recorrência elegível (ativa, não removida, dentro da vigência), tenta inserir seu lançamento daquele mês via `INSERT ... ON CONFLICT (recurrence_id, month, year) DO NOTHING`, usando o índice único parcial já existente como mecanismo de idempotência — tudo dentro de `db.transaction()`.
- **Por que mudar**: a checagem em lote tem um efeito colateral ruim — uma recorrência criada depois que o mês já foi gerado para outras recorrências nunca aparece retroativamente naquele mês, mesmo estando dentro da janela de vigência por `created_at`. Isso surpreende o usuário sem necessidade.
- **Por que é seguro trocar**: o índice único `(recurrence_id, month, year) WHERE recurrence_id IS NOT NULL` já ia existir de qualquer forma como rede de segurança contra concorrência; usá-lo como mecanismo primário de idempotência (via `ON CONFLICT DO NOTHING`) é, na prática, **mais simples e mais barato** que fazer um SELECT em lote antes — não é uma troca de robustez por complexidade, é estritamente melhor nos dois eixos.
- **Bônus**: um lançamento avulso existente no mês nunca interfere na geração das recorrências (a checagem nem olha pra avulsos), então o bug que a leitura ingênua do algoritmo em lote teria (avulso bloqueando geração de recorrência) nem chega a existir nesse desenho.

### Elegibilidade de uma recorrência na geração
Uma recorrência entra na geração de um mês/ano quando: `active = true` (estado **atual**, sem reconstrução histórica — ver Risks), `deleted_at IS NULL`, e o mês/ano de `created_at` é igual ou anterior ao mês/ano consultado.

### `due_date`: `due_day` clampado ao último dia do mês
`due_date = min(recurrence.due_day, número de dias do mês consultado)`. Sem isso, `due_day = 31` quebraria em meses de 30 dias ou fevereiro.

### Consultas de mês futuro retornam prévia calculada, sem persistir
Diferente da decisão inicial (rejeitar com 400), o usuário decidiu que navegar pra frente é importante o suficiente pra valer a complexidade extra. Mesma lógica do "upcoming invoice" do Stripe: computa mas não persiste.
- Comparação de "é futuro?" feita contra a data atual do servidor (`now()`), não contra timezone do cliente.
- A mesma lógica de elegibilidade de recorrência (ativa, não removida, dentro da vigência) é reaproveitada — só que o resultado é retornado na resposta sem passar por `INSERT`, sem tocar `installments_generated`/`active`.
- **Cálculo de `installment_number` na prévia é uma aproximação**: `installments_generated atual + número de meses entre agora e o mês consultado`; se isso ultrapassar `installments_total`, a recorrência simplesmente não aparece na prévia daquele mês (ela já teria se auto-desativado antes de chegar lá). Não simula mês a mês o que aconteceria entre hoje e o mês futuro (ex: uma pausa manual que o usuário venha a fazer nesse meio-tempo) — é uma prévia, assume que nada muda até lá, o que é inerente ao conceito de prévia.
- **Itens de prévia não têm `id`**: como nada é persistido, não existe um identificador real pra editar/pagar/pular. O array de resposta mistura itens reais (avulsos já cadastrados pra aquele mês, que têm `id` normal) com itens de prévia (sem `id`) — o frontend distingue pela ausência de `id`.
- **Alternativa considerada**: gerar e persistir de verdade ao consultar um mês futuro. Rejeitada — dados gerados antecipadamente ficariam "presos" com valores desatualizados se a recorrência for editada antes daquele mês chegar de verdade (contraria a garantia de "edição de template não retroage", mas ao contrário: dado futuro nasceria já desatualizado antes mesmo de existir de fato).

### Criação de avulso: `month`/`year` sempre derivados de `due_date`
Nunca aceitos como campos de entrada separados — evita divergência entre "o avulso diz que é de outubro" e "a data de vencimento é em novembro". Única fonte de verdade é `due_date`.

### `due_date` é sempre string ISO (`YYYY-MM-DD`), nunca `Date`/timestamp — bug encontrado e corrigido durante a implementação
A primeira versão implementada usava `date('due_date', { mode: 'date' })` no Drizzle (mapeia pra `Date` do JS) e derivava `month`/`year` com `.getMonth()`/`.getFullYear()` (getters de fuso **local**). O servidor roda em UTC-3. Um `dueDate` de entrada como `"2026-10-01"` é parseado pelo `Date` do JS como **meia-noite UTC**, que em UTC-3 é `"2026-09-30 21:00" local` — ou seja, `.getMonth()` local devolvia **setembro em vez de outubro**, um lançamento de 1º de outubro caindo silenciosamente no mês errado.
- **Correção**: `due_date` passou a ser tratado como string ISO pura em toda a stack — schema (`date('due_date')`, modo `string` do Drizzle), DTOs (`z.iso.date()` do Zod, que valida e devolve a string, nunca um `Date`), e toda a lógica de mês/ano no Service extrai os componentes direto da string (`slice(0,4)`/`slice(5,7)`) em vez de instanciar `Date` e usar getters. Comparação de `isOverdue` também virou comparação de string (`dueDate < hoje` como `"YYYY-MM-DD" < "YYYY-MM-DD"`, que funciona porque esse formato é ordenável lexicograficamente = ordenável cronologicamente).
- **Por que isso é a correção certa, não só um workaround**: um `due_date` (`date` do Postgres) não tem horário nem timezone — é um valor de calendário puro. Modelar isso como `Date` do JS (que é sempre um instante no tempo, amarrado a UTC internamente) introduz um conceito que não existe no dado original. Tratar como string evita a categoria inteira de bug, não só o caso que apareceu no teste.
- **`settled_at` continua sendo `Date`/timestamp de verdade** (não muda) — ele representa um instante real (quando a liquidação aconteceu), diferente de `due_date`, que é só uma data de calendário.
- Achado durante teste manual real (não em revisão de código) — a prévia de mês futuro expunha o problema primeiro como uma inconsistência cosmética (`due_date` de itens de prévia vinha com `T03:00:00.000Z` em vez de `T00:00:00.000Z` dos itens persistidos), o que levou a investigar e achar o bug de verdade (mês errado na criação de avulso perto da virada do mês).

### Edição: campos permitidos variam por origem do lançamento
- **Avulso** (`recurrence_id` nulo): `amount`, `description`, `category_id`, `due_date`, `type` — todos editáveis livremente.
- **Vinculado a recorrência**: `amount`, `description`, `category_id`, `due_date` editáveis; `type` **não** (rejeitado com 400) — trocar despesa↔receita muda a natureza contábil do lançamento, e nenhum sistema de referência permite isso in-place num item já gerado a partir de um template.
- **`due_date` só pode mudar dentro do mesmo `month`/`year`** do lançamento (novo, não estava nos 12 gaps originais): como `month`/`year` são as chaves de isolamento entre meses (CLAUDE.md seção 5.2), permitir mover um lançamento pra outro mês via `due_date` quebraria essa invariante (ex: poderia colidir com um lançamento que a geração normal criaria naquele mês de destino). Editar `due_date` serve pra ajustar o dia dentro do mesmo mês (ex: "esse mês o boleto venceu no 8 por causa do feriado"), não pra mover de mês.
- **Editar lançamento já liquidado sincroniza a `transaction`**: mesmo padrão de correção retroativa que YNAB/Mint permitem.

### Exclusão: só avulso, e só se ainda não liquidado
- Lançamento vinculado a recorrência nunca pode ser excluído (409) — **não é mais só "aceitar a limitação"**: existe uma ferramenta própria pra isso agora (`skip`, ver decisão abaixo), então proibir exclusão deixou de ser uma lacuna e virou uma escolha consciente de ter um único caminho por finalidade (excluir é só pra dado que não devia existir; pular é pra "esse mês não se aplica").
- Avulso liquidado (`transaction_id` preenchido) também não pode ser excluído diretamente (409) — precisa passar por `unsettle` primeiro. Isso mantém um único caminho pra remover uma `transaction` (o endpoint de `unsettle`), em vez de duplicar a lógica de limpeza em dois lugares (delete direto vs. unsettle).
- **Sem soft delete em `monthly_entries`**: diferente de `categories`/`recurrences`, não há necessidade de preservar histórico de um avulso excluído (nada mais referencia um `monthly_entry` por FK) — exclusão de avulso é `DELETE` físico.

### Skip/unskip: pular um mês específico de uma recorrência sem pausá-la inteira
Resolve o gap de não existir "exceção de uma ocorrência" (problema clássico de recurring events, que o Google Calendar resolve com lista de exceções). Em vez de implementar uma lista de exceções separada, reaproveitamos a própria coluna `status`, adicionando um terceiro valor: `'pulado'`.
- `POST /monthly-entries/:id/skip`: só aceito em lançamento com `recurrence_id` preenchido e `status: 'pendente'`. Define `status: 'pulado'`. Lançamento avulso não tem por que ser pulado — pra um avulso, a ferramenta certa já existe (`DELETE`).
- `POST /monthly-entries/:id/unskip`: só aceito com `status: 'pulado'`, volta pra `'pendente'`.
- **`installments_generated`/`installment_number` não são revertidos ao pular**: a parcela já foi contada no momento da geração; pular só decide "esse ciclo não vai ser liquidado", não "essa parcela nunca existiu". Reajustar a numeração das parcelas seguintes (ex: "empurrar" a parcela 5 pra virar a nova parcela 5 do mês seguinte) é um problema bem mais complexo (muda o cronograma inteiro) e fica fora de escopo — ver Non-Goals.
- **`'pulado'` nunca é `isOverdue`**: mesma lógica de `'liquidado'`, só `'pendente'` conta como possivelmente atrasado.
- **`CHECK` de `status`** precisa incluir os 3 valores: `CHECK (status IN ('pendente', 'liquidado', 'pulado'))`.

### `settle`/`unsettle` como endpoints de ação dedicados, não `PATCH status`
Mesmo padrão do Stripe (`POST /invoices/:id/pay` em vez de editar o status via PATCH genérico) — porque a ação tem efeito colateral real (criar/apagar uma `transaction`), diferente do `active` de `recurrences` (que era só um campo, sem side effect).
- `POST /monthly-entries/:id/settle`: body `{ settledAt?: string }`, default `now()`. Copia `category_id`/`description`/`type`/`amount` do lançamento pra nova `transaction`.
- `POST /monthly-entries/:id/unsettle`: sem body. Apaga a `transaction` vinculada, limpa `transaction_id`, volta `status: 'pendente'`.
- Liquidar um já liquidado ou pulado, ou desfazer um já pendente: rejeitado com 409 (estado inconsistente com a ação pedida).
- **Bug encontrado no teste manual**: `unsettle` (então chamado `unpay`) inicialmente apagava a `transaction` antes de limpar `monthly_entries.transaction_id`, violando a FK (`monthly_entries_transaction_id_transactions_id_fk`) — Postgres rejeita apagar uma linha ainda referenciada. Corrigido invertendo a ordem (limpar a FK primeiro, apagar a `transaction` depois) dentro de uma `db.transaction()` única, garantindo atomicidade entre os dois passos.

### Renomeação `pago`/`pay`/`paid_at` → `liquidado`/`settle`/`settled_at`
A primeira versão implementada usava vocabulário de despesa ("pago", rota `/pay`, coluna `transactions.paid_at`) mesmo o `type` podendo ser `'receita'` — um lançamento de receita "paga" não faz sentido conceitual ("Salário está pago"?). Corrigido após revisão manual, trocando por termos neutros entre despesa e receita:
- `monthly_entries.status`: `'pago'` → `'liquidado'` (termo financeiro em português que vale tanto pra pagamento quanto recebimento, consistente com a convenção do projeto de domínio em português — CLAUDE.md seção 2)
- Rotas: `/pay` → `/settle`, `/unpay` → `/unsettle` (inglês, consistente com `/skip`/`/unskip`, que também já eram neutros)
- Coluna: `transactions.paid_at` → `settled_at`
- **Migration**: como já havia dado de teste com `status = 'pago'` no banco local, a migration (`0005_rename_paid_at_to_settled_at.sql`) primeiro remove o `CHECK` antigo, faz `UPDATE` migrando `'pago'` → `'liquidado'`, e só então recria o `CHECK` com os novos valores — nessa ordem exata, porque tentar popular `'liquidado'` antes de remover o `CHECK` antigo violaria a constraint vigente.

### `isOverdue`: campo calculado, nunca persistido
`isOverdue = status === 'pendente' && due_date < hoje`, calculado no Service (ou num mapper de resposta) toda vez que um `monthly_entry` é serializado — nunca gravado no banco, consistente com a regra já documentada no CLAUDE.md.

### Parcelas: `installment_number` como snapshot na geração
Ao gerar o lançamento de uma recorrência com `installments_total` preenchido: `installment_number = installments_generated + 1` (valor no momento da geração), gravado no `monthly_entry`; em seguida `installments_generated` da recorrência é incrementado. Se o novo `installments_generated` igualar `installments_total`, a recorrência é desativada (`active = false`, sem tocar `deleted_at`) na mesma transação da geração.
- **Auto-desativação não se autorreverte**: se o usuário depois aumentar `installments_total` (ex: de 12 pra 15), a recorrência continua `active: false` — precisa de um `PATCH { active: true }` explícito. Mesmo racional de assinaturas Stripe: nada reativa uma assinatura cancelada só porque um campo foi editado, é sempre uma ação separada e explícita.

### Novas tabelas ganham `CHECK` de banco (paga o gap documentado no CLAUDE.md)
`type` (`CHECK (type IN ('despesa', 'receita'))`) em `monthly_entries` e `transactions`; `status` (`CHECK (status IN ('pendente', 'liquidado', 'pulado'))`) em `monthly_entries`. `recurrences` não é alterada retroativamente neste change (fica registrado como debt continuado, não é escopo daqui).

### `account_id` obrigatório (emenda coordenada com `add-accounts-module`)
`monthly_entries` e `transactions` ganham `account_id` (fk -> `accounts`, `NOT NULL`), tratado exatamente como `category_id` já é tratado neste change: validado por ownership na criação/edição de avulso (`AccountsRepository.findOwnedById`), copiado da recorrência na geração automática, copiado do `monthly_entry` pra `transaction` no `settle`, e sincronizado de volta se um lançamento já liquidado tiver o `account_id` editado. Ver `add-accounts-module/design.md` pra decisões específicas de `accounts` (saldo derivado, migração de dados tornando a coluna obrigatória em registros pré-existentes).

## Risks / Trade-offs

- **`active` sem reconstrução histórica** → se uma recorrência for pausada e só depois disso o usuário consultar, pela primeira vez, um mês passado em que ela deveria ter gerado lançamento, esse lançamento nunca é criado (porque a checagem usa o estado atual). Mitigação: aceito como simplificação para o estágio do produto (decisão confirmada explicitamente); resolver isso exigiria um log de eventos de mudança de `active`, over-engineering aqui, e cobriria só parcialmente mesmo com um campo simples (`paused_at` não reconstrói múltiplos ciclos de pausa/reativação).
- **`skip` não reajusta o cronograma de parcelas** → pular a parcela 5 de 12 não "empurra" as seguintes; a numeração continua avançando normalmente, então o plano termina no mesmo mês previsto originalmente, só com um mês sem pagamento no meio. Mitigação: aceitável no MVP — reagendar parcelas é uma feature bem mais complexa (mudaria `installment_number` de tudo que já foi gerado depois); se necessário no futuro, é um change à parte.
- **Prévia de mês futuro pode ficar imprecisa se o usuário editar recorrências antes do mês chegar** → é inerente ao conceito de prévia (calculada sem persistir, assume estado atual mantido). Mitigação: nenhuma necessária — a prévia nunca é a fonte de verdade, só um adiantamento; quando o mês realmente chegar, a geração de verdade usa o estado real da recorrência naquele momento.
- **Dois pontos de verdade pra "mês do lançamento"** (`due_date` vs. `month`/`year`) → mitigado por `month`/`year` serem sempre derivados de `due_date` na criação, e a edição de `due_date` ser restrita a não sair do mês atual, então nunca ficam dessincronizados.

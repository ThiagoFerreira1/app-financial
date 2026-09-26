## Context

`categories` já estabeleceu o padrão de ownership-na-query (`findOwnedById` filtrando `id` + `user_id` + `deleted_at IS NULL`) e soft delete sem restore. `recurrences` reaproveita esse padrão e adiciona: uma segunda FK (`category_id`), um segundo booleano de estado (`active`, além de `deleted_at`), e será a base de dados que o futuro módulo `monthly-entries` vai consumir. Ver proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Definir como a validação de `category_id` (pertence ao usuário, não removida) é aplicada de forma consistente em criação e edição
- Definir a relação entre `active` e `deleted_at` — quando cada um muda e por quê
- Definir o modelo de dados que distingue recorrência indefinida de parcelamento com fim definido
- Deixar registrado, para quando `monthly-entries` for implementado: que edições no template não retroagem sobre lançamentos já gerados, que a geração nunca é retroativa a antes da criação da recorrência, e que uma recorrência parcelada se auto-desativa ao esgotar as parcelas

**Non-Goals:**
- Não cobre o que acontece quando uma `category` referenciada é deletada depois (decisão já tomada: permitir, sem bloqueio — a recorrência mantém a FK, a listagem/detalhe de categoria simplesmente não a mostra mais como opção ativa)
- Não cobre a geração de `monthly_entries` em si — isso é responsabilidade de um change futuro, este design só declara as garantias que esse módulo futuro deve respeitar
- Não cobre periodicidade diferente de mensal (semanal, trimestral, anual) — fora do escopo do MVP; toda recorrência (indefinida ou parcelada) gera no máximo 1 lançamento por mês

## Decisions

### Validação de `category_id` reaproveitando o padrão de `categories`
Antes de criar/editar, o `RecurrencesService` consulta `CategoriesRepository.findOwnedById(categoryId, userId)` (já existe, criado para `categories`). Se não encontrar (não existe, é de outro usuário, ou está removida), lança `NotFoundException` — mesmo comportamento de "não revela detalhe" já usado em `categories`.
- **Alternativa considerada**: duplicar a query de ownership dentro de `RecurrencesRepository`. Rejeitada — reusar o repository do módulo dono da entidade evita duas fontes de verdade para "o que é uma categoria válida do usuário".
- Isso significa `RecurrencesModule` importa `CategoriesModule` (que precisa exportar `CategoriesRepository`).

### `active` e `deleted_at` são estados relacionados, não independentes
Regra: **toda vez que `deleted_at` é preenchido, `active` é forçado para `false` na mesma escrita.** Nunca existe o estado `deleted_at != null AND active = true`. O inverso não é restringido: uma recorrência pode estar `active = false` sem estar removida (pausada, mas visível/editável/reativável).
- **Alternativa considerada**: usar só `deleted_at` e tratar "pausada" como um caso especial de removida com flag extra. Rejeitada porque pausar é uma ação reversível e frequente (usuário cancela e recontrata um serviço), enquanto remover é permanente — misturar os dois estados dificultaria a query de "recorrências pausadas mas ainda existentes" que a listagem com `active=false` precisa responder.
- `active` é um campo comum do DTO de edição (`PATCH`), não uma ação/endpoint dedicado — não há efeito colateral (notificação, cobrança) que justifique uma rota própria neste estágio.

### Edição de template não é retroativa (declarado, não implementado ainda)
Como `monthly-entries` ainda não existe, não há o que testar hoje — mas a decisão fica registrada aqui para o próximo change: `monthly_entries` deve copiar os dados da recorrência (`description`, `type`, `amount`, `category_id`) no momento da geração, não referenciar os campos da recorrência por leitura indireta. Assim, editar a recorrência depois nunca muda um `monthly_entry` já gerado — mesma garantia (espelhada) da regra já existente "editar um `monthly_entry` não afeta o template".

### Sem unicidade de `description`
Diferente de `categories`, não há índice único sobre `description`. Duas recorrências com a mesma descrição (ex: duas faturas de cartão diferentes) são um caso de uso legítimo.

### Recorrência indefinida vs. parcelamento: `installments_total` nullable + `installments_generated`
"Recorrência" (aluguel, internet — sem fim natural) e "parcela" (compra em 12x — fim definido) são conceitos diferentes, mas modelados na mesma tabela via dois campos:
- `installments_total` (integer, nullable): `null` = recorrência indefinida; um número = parcelamento com esse total de ocorrências.
- `installments_generated` (integer, not null, default 0): quantas ocorrências já foram geradas. Gerido só internamente (pelo futuro `monthly-entries`), nunca aceito como entrada do cliente — os DTOs de create/update de `recurrences` nem declaram esse campo, então o Zod já descarta qualquer valor enviado por engano (`z.object` usa modo `strip` por padrão).
- **Alternativa considerada**: uma tabela/entidade separada `installment_plans` distinta de `recurrences`. Rejeitada por over-engineering neste estágio — os dois conceitos compartilham 100% dos outros campos (categoria, valor, dia de vencimento, dono) e a única diferença observável é "tem fim definido ou não"; dois campos nullable resolvem isso sem duplicar CRUD, ownership e validação inteiros.
- **Alternativa considerada**: `current_installment` (1-indexado, "estou na parcela X") em vez de `installments_generated` (contagem). Rejeitada por ser redundante — `current_installment = installments_generated + 1` no momento de gerar a próxima, e manter as duas seria uma fonte de inconsistência.
- Editar `installments_total` para baixo do `installments_generated` atual é rejeitado (400) — evita um estado sem sentido (ex: dizer "só 3 parcelas" quando já foram geradas 5).
- Não há restrição para editar de indefinida → parcelada ou vice-versa (só setar/limpar `installments_total`); é uma correção de cadastro legítima (usuário errou ao cadastrar).

### Vigência: geração nunca retroage a antes de `created_at` (declarado, não implementado ainda)
Sem campo novo — o futuro `monthly-entries`, ao gerar lançamentos para um mês/ano consultado, deve ignorar recorrências cujo `created_at` seja posterior àquele mês/ano. Isso evita que uma recorrência cadastrada hoje "apareça" retroativamente em meses passados que o usuário navegue.

### Auto-desativação ao esgotar parcelas (declarado, não implementado ainda)
Quando o futuro `monthly-entries` gerar uma ocorrência e, com isso, `installments_generated` atingir `installments_total`, ele deve setar `active = false` na mesma operação (não `deleted_at` — a recorrência quitada continua visível/consultável, só para de gerar novas ocorrências). Mesmo mecanismo de "desativação" já usado para pausa manual, só que disparado automaticamente pelo sistema em vez de por ação do usuário.

### Rastreabilidade de qual parcela cada lançamento representa (declarado, não implementado ainda)
`installments_generated` é só um contador — ele diz "quantas ocorrências já existem", não "esse `monthly_entry` específico era a parcela 4 de 12". São dois conceitos diferentes:
- **Parcela emitida**: contada por `installments_generated` em `recurrences`.
- **Parcela paga**: já modelado em `monthly_entries` (CLAUDE.md seção 6) via `status` (`'pendente' | 'pago'`) + `transaction_id`.

Nenhum dos dois, isoladamente, responde "qual número de parcela era este lançamento". Decisão para o futuro `monthly-entries`: adicionar um campo `installment_number` (integer, nullable) em `monthly_entries`, preenchido como **snapshot no momento da geração** (`installments_generated + 1` daquele instante) e nunca recalculado depois — mesmo que `installments_total` seja editado posteriormente na recorrência. Isso permite a UI mostrar "Parcela 4/12" de forma estável e determinar quitação total como "o `monthly_entry` com `installment_number == installments_total` está `status = 'pago'`", sem depender do estado atual (mutável) do contador na recorrência.
- **Alternativa considerada**: calcular o número da parcela em tempo de leitura, contando quantos `monthly_entries` daquela `recurrence_id` existem até a data. Rejeitada — quebra se um lançamento avulso for editado/excluído no meio do caminho, e recalcula diferente conforme `installments_total` muda; um snapshot gravado na geração é imutável e correto por construção.

## Risks / Trade-offs

- **`RecurrencesModule` depende de `CategoriesModule`** → acoplamento direto entre dois módulos de domínio. Mitigação: é uma dependência de leitura só (`findOwnedById`), unidirecional, e reflete uma relação de dados real (FK) — não é acoplamento arbitrário.
- **Órfãos de categoria removida** → uma recorrência pode apontar para uma categoria já removida (criada antes da remoção). Mitigação: aceitável por design (ver Non-Goals); a listagem de recorrências não depende de a categoria estar ativa para funcionar, só a criação/edição exige categoria não removida no momento da operação.
- **Garantias de vigência, auto-desativação e rastreabilidade de parcela são só declarativas neste change** → nada aqui impede hoje uma geração retroativa, uma recorrência parcelada "vazando" além do total, ou um `monthly_entry` sem saber qual parcela representa, porque `monthly-entries` ainda não existe para violar ou respeitar essas regras. Mitigação: registrado explicitamente neste design.md para ser cobrado na revisão do change de `monthly-entries`.

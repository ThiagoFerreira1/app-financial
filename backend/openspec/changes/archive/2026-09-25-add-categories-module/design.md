## Context

Hoje só existe a tabela `users` e o módulo `auth`. `categories` é a primeira entidade de domínio "de negócio" do sistema (não relacionada a autenticação), e serve de referência de convenção para os próximos módulos (`recurrences`, `monthly-entries`). Ver proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Definir como a checagem de propriedade (usuário só acessa a própria categoria) é aplicada de forma consistente nas 3 operações que recebem um `id` (editar, remover, e futuramente qualquer leitura por id)
- Definir como a unicidade de `name` por usuário é garantida (criação e edição), incluindo o caso de reuso de nome de categoria já removida
- Estabelecer o padrão de DTO/validação que os próximos módulos CRUD vão repetir

**Non-Goals:**
- Não cobre uso de `category_id` por `recurrences`/`monthly-entries` — isso é responsabilidade de changes futuros

## Decisions

### 404 em vez de 403 para categoria de outro usuário
Ao tentar editar/remover uma categoria que existe mas pertence a outro usuário, o sistema responde como se o recurso não existisse (`NotFoundException`, 404), não como "acesso negado" (403).
- **Alternativa considerada**: 403 Forbidden. Rejeitada porque confirmaria a existência do `id` para quem não é dono dele (enumeração de recursos de outro usuário).

### Ownership resolvido na própria query do repository
O `CategoriesRepository` filtra por `id`, `user_id` e `deleted_at IS NULL` na mesma query (ex: `findOwnedById(id, userId)`), em vez do Service buscar por `id` isolado e depois comparar `user_id` em memória.
- **Alternativa considerada**: buscar por `id` e checar `category.userId === userId` no Service. Rejeitada por ser uma query a mais sem necessidade e por espalhar a regra de ownership entre Service e Repository; concentrar no filtro da query deixa a garantia num único lugar.
- Essa mesma query (`id` + `user_id` + `deleted_at IS NULL`) é reaproveitada por editar e remover, então "não encontrado", "de outro usuário" e "já removido" caem no mesmo 404 — o que já é o comportamento pedido pela spec.

### Unicidade de nome: índice parcial + checagem no Service (mesmo padrão do `auth`)
`categories` ganha um índice único parcial em `(user_id, lower(name)) WHERE deleted_at IS NULL` (via `uniqueIndex` do Drizzle). O `CategoriesService` faz a mesma checagem que `AuthService.register()` já faz para email: busca por nome (case-insensitive) antes de criar/atualizar e lança `ConflictException` (409) com mensagem clara; o índice no banco é a rede de segurança contra corrida (duas requisições simultâneas), não o mecanismo primário de erro amigável.
- **Alternativa considerada**: só o índice único do banco, deixando o erro de constraint estourar como 500 genérico via `AllExceptionsFilter`. Rejeitada porque não produz uma mensagem de domínio nem o status 409 esperado pela spec — precisaria de tratamento especial do erro do driver Postgres (código `23505`) no filter, mais frágil que checar antes no Service.
- **Alternativa considerada**: índice único total (sem `WHERE deleted_at IS NULL`). Rejeitada porque bloquearia recriar uma categoria com o mesmo nome de uma já removida — a spec exige que categorias removidas não contem pra checagem de duplicidade.
- **Case-insensitive**: comparação ignora maiúsculas/minúsculas (`lower(name)`) — assunção registrada na spec para evitar "Alimentação" e "alimentação" coexistindo por engano. Se o usuário preferir case-sensitive, é só o índice e o filtro de busca do Service mudarem, sem afetar o resto do desenho.
- **Edição para o próprio nome atual**: a checagem de duplicidade no update deve excluir a própria categoria sendo editada (`id != :id` na busca de conflito), senão renomear mantendo o mesmo nome sempre falharia.

### DTO com Zod puro (sem drizzle-zod)
O DTO de criação/edição (`{ name: string }`) usa `z.object` direto, no mesmo estilo do `register.dto.ts`/`login.dto.ts` do módulo `auth`.
- **Alternativa considerada**: derivar de `createInsertSchema(categories)` via `drizzle-zod` (mencionado como preferência geral no CLAUDE.md). Para um único campo de texto livre, isso adicionaria indireção sem reduzir duplicação real — mantido consistente com o padrão já usado no `auth`.

## Risks / Trade-offs

- **Padrão de ownership-na-query precisa ser lembrado em cada novo método de repository** que receba `id` → mitigação: manter a superfície do `CategoriesRepository` pequena (só os métodos do CRUD) e usar este design.md como referência para `recurrences`/`monthly-entries`, que terão a mesma necessidade.
- **Checagem de duplicidade no Service + índice no banco são dois pontos de verdade** → uma race condition entre a busca e o insert ainda pode escapar da checagem do Service e cair no índice do banco, que hoje resultaria em erro 500 genérico (não tratado como 409). Mitigação: aceitável para volume de um usuário só/poucas requisições simultâneas; se necessário no futuro, tratar o código de erro `23505` do driver Postgres no fluxo do Service e convertê-lo em `ConflictException`.

## Migration Plan

Tabela nova, sem dado pré-existente para migrar: `drizzle-kit generate` gera a migration de criação de `categories`, `drizzle-kit migrate` aplica. Sem rollback especial além do padrão do Drizzle (a migration down é gerada automaticamente).

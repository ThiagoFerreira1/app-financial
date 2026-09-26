## Context

`GET /v1/categories` hoje chama `CategoriesRepository.findAllByUser(userId)`, que filtra só por `user_id` e `deleted_at IS NULL`. Ver proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Definir o formato do query parameter e onde a validação de "mínimo 3 caracteres" acontece
- Definir o tipo de correspondência usado no filtro (substring vs prefixo)

**Non-Goals:**
- Não cobre paginação da listagem — fora de escopo deste change
- Não cobre filtro por outro campo além de `name`

## Decisions

### Validação do query param via Zod, no Controller
O `CategoriesController.findAll` passa a receber `@Query()` validado por um schema Zod (`z.object({ name: z.string().min(3).optional() })`), no mesmo padrão de `ZodValidationPipe` já usado nos DTOs de body.
- **Alternativa considerada**: validar dentro do Service. Rejeitada para manter consistência com o resto do projeto, onde validação de entrada é sempre responsabilidade da camada Controller (via pipe), nunca do Service.

### Correspondência por substring (`ILIKE '%valor%'`), não só prefixo
O filtro usa `ILIKE` do Postgres com `%` nas duas pontas, permitindo achar "Mercado" digitando "erca".
- **Alternativa considerada**: prefixo (`ILIKE 'valor%'`), que poderia usar o índice existente `(user_id, lower(name))` de forma mais eficiente. Rejeitada porque a expectativa de busca do usuário é encontrar por qualquer parte do nome, não só pelo início; o volume de categorias por usuário é pequeno o suficiente (dezenas, não milhares) para o custo do scan não ser um problema real.

### `findAllByUser` ganha um segundo parâmetro opcional
`findAllByUser(userId: string, nameFilter?: string)` — quando `nameFilter` é informado, adiciona a condição `ilike(categories.name, `%${nameFilter}%`)` ao `where` já existente.
- **Alternativa considerada**: criar um método novo `searchByName` separado. Rejeitada por duplicar a mesma base de filtro (`user_id` + `deleted_at IS NULL`) que `findAllByUser` já tem.

## Risks / Trade-offs

- **`ILIKE '%...%'` não usa índice** → em volume muito maior de categorias por usuário isso escalaria mal. Mitigação: aceitável para o tamanho esperado (app pessoal); se necessário no futuro, um índice `pg_trgm` resolveria sem mudar a spec.

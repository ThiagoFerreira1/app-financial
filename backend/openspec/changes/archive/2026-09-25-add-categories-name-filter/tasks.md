## 1. DTO de query

- [x] 1.1 Criar `src/modules/categories/dto/find-categories-query.dto.ts` com schema Zod (`name` opcional, string com mínimo 3 caracteres) e verificar que `name` com menos de 3 caracteres é rejeitado com 400

## 2. Repository

- [x] 2.1 Alterar `findAllByUser(userId, nameFilter?)` em `categories.repository.ts` para adicionar `ilike(categories.name, \`%${nameFilter}%\`)` ao `where` quando `nameFilter` for informado
- [x] 2.2 Verificar manualmente contra o Postgres local: busca parcial case-insensitive encontra categoria, busca sem correspondência retorna lista vazia, sem `nameFilter` retorna tudo como antes

## 3. Service e Controller

- [x] 3.1 Atualizar `CategoriesService.findAll(userId, nameFilter?)` para repassar o filtro ao repository
- [x] 3.2 Atualizar `CategoriesController.findAll` para receber `@Query(new ZodValidationPipe(findCategoriesQuerySchema))` e repassar `name` ao service
- [x] 3.3 Verificar que a rota continua protegida por `JwtAuthGuard` e respondendo no envelope padronizado com o novo parâmetro

## 4. Documentação

- [x] 4.1 Atualizar `http/categories.http` com exemplo de listagem filtrada por `name`, listagem sem filtro (comportamento atual) e do erro de menos de 3 caracteres (400)

## 5. Verificação end-to-end manual

- [x] 5.1 Rodar manualmente: listar sem filtro (comportamento igual a antes) → listar com filtro de 3+ caracteres encontrando categoria por substring case-insensitive → listar com filtro sem correspondência (lista vazia) → listar com filtro de 1-2 caracteres (400) → confirmar que categorias de outro usuário e removidas continuam de fora do resultado filtrado

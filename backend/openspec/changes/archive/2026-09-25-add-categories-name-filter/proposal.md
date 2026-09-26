## Why

A listagem `GET /v1/categories` hoje só retorna todas as categorias do usuário sem filtro. Conforme o número de categorias cresce, o usuário (e o app mobile futuramente) precisa de uma forma de buscar rapidamente uma categoria pelo nome em vez de rolar a lista inteira.

## What Changes

- `GET /v1/categories` passa a aceitar um query parameter opcional `name` para filtrar as categorias retornadas por correspondência parcial (substring), sem diferenciar maiúsculas/minúsculas, no campo `name`
- Se `name` for enviado com menos de 3 caracteres, a requisição é rejeitada com 400 (mesmo padrão de validação Zod já usado nos outros DTOs do projeto)
- Se `name` não for enviado, o comportamento atual (lista completa, sem filtro) é mantido
- O filtro continua respeitando as regras já existentes: só categorias não removidas, só do usuário autenticado

## Capabilities

### New Capabilities
_Nenhuma._

### Modified Capabilities
- `categories`: o requirement "Category Listing" passa a suportar filtro opcional por `name` (mínimo 3 caracteres)

## Impact

- **Código alterado**: `src/modules/categories/dto/` (novo DTO de query), `src/modules/categories/controller/categories.controller.ts` (recebe e valida o query param), `src/modules/categories/service/categories.service.ts` (repassa o filtro), `src/modules/categories/categories.repository.ts` (`findAllByUser` ganha um filtro opcional)
- **Documentação**: `http/categories.http` ganha exemplos com e sem o filtro, e do caso de erro (menos de 3 caracteres)
- Não requer migration — o filtro é feito sobre a coluna `name` já existente

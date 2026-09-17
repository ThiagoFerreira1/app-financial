# CLAUDE.md — Backend (app-financial)

Manual de referência do backend. Sempre consultar este arquivo antes de gerar
ou modificar código neste projeto — ele documenta decisões já tomadas e não
deve ser contrariado sem confirmação explícita do usuário.

---

## 1. Contexto

Sistema financeiro pessoal para substituir uma planilha de controle mensal.
O usuário quer visualizar, por mês, o que precisa pagar e o que vai receber —
contas fixas/recorrentes (aluguel, internet, salário) e lançamentos avulsos
(despesas/receitas pontuais) — marcando cada item como pago/recebido conforme
acontece.

Este repositório é parte de um monorepo: `backend/` (este projeto, API) +
`app/` (Flutter, mobile).

---

## 2. Tecnologias

- **Framework**: NestJS + TypeScript
- **ORM/Query builder**: Drizzle ORM
- **Banco de dados**: PostgreSQL
- **Gerenciador de pacotes**: npm
- **Validação**: Zod (preferir `drizzle-zod` para derivar schemas de
  validação diretamente dos schemas de tabela, evitando duplicação de tipos)
- **Autenticação**: JWT (access token curto + refresh token longo), hash de
  senha com bcrypt
- **Migrations**: drizzle-kit (`generate` + `migrate`)
- **Config**: `@nestjs/config` com validação de variáveis de ambiente no boot

### Convenção de idioma

- Código (arquivos, classes, funções, variáveis): **inglês**
- Termos de domínio/negócio (valores de enum, mensagens ao usuário):
  **português** — ex: campo `type` aceita `'despesa' | 'receita'`, campo
  `status` aceita `'pendente' | 'pago'`

---

## 3. Arquitetura

Padrão em camadas do Nest, com Repository explícito — necessário porque
Drizzle é query builder puro e não abstrai acesso a dados sozinho (diferente
do Prisma):

```
Controller → Service → Repository → Drizzle client → Postgres
```

- **Controller**: recebe request, valida DTO (Zod), chama Service, devolve
  resposta no envelope padronizado (seção 7). Nunca contém lógica de negócio.
- **Service**: toda a lógica de negócio (seção 5) vive aqui. Chama um ou mais
  Repositories. Deve ser testável isoladamente (mockando Repository).
- **Repository**: só queries Drizzle. Não conhece regra de negócio.

### O que evitar

- Não criar `BaseRepository<T>` genérico — com poucas entidades, é
  over-engineering. Repository específico por entidade.
- Não usar CQRS, Clean/Hexagonal Architecture completa nem microserviços —
  é um monolito modular simples, para um usuário só.
- Toda operação que grava em mais de uma tabela (geração mensal, sync entre
  lançamento e transação) deve rodar dentro de `db.transaction()`.

---

## 4. Organização

Módulos organizados **por feature** (não por tipo de arquivo), seguindo o
padrão nativo do Nest:

- `auth` — registro, login, refresh de token
- `categories` — CRUD de categorias
- `recurrences` — CRUD de recorrências (templates de contas fixas/variáveis)
- `monthly-entries` — o módulo mais importante: geração on-demand dos
  lançamentos do mês e sincronização com transações
- `transactions` — histórico de transações realizadas; sem controller
  próprio por ora, acessado internamente só pelo módulo `monthly-entries`
- `database` — configuração do Drizzle client e schemas de tabela
- `common` — guards, filters, interceptors e decorators compartilhados
- `config` — validação de variáveis de ambiente

Cada módulo de domínio (`categories`, `recurrences`, `monthly-entries`) segue
sempre o trio `controller` + `service` + `repository` + pasta `dto/`.

---

## 5. Escopo

### 5.1 Funcionalidades do MVP

1. Login/cadastro (email + senha)
2. Cadastrar recorrência (nome, tipo, valor padrão, dia de vencimento)
3. Visão do mês (lançamentos gerados automaticamente a partir das
   recorrências + lançamentos avulsos)
4. Marcar como pago/recebido (vira transação automaticamente)
5. Lançar avulso (despesa/receita não recorrente)
6. Navegar entre meses

Fora do MVP por enquanto: gráficos/relatórios, categorias com CRUD avançado,
orçamento/metas, múltiplas contas, login social, modo offline, notificações
push, exportação, biometria.

### 5.2 Regras de negócio

**Status "atrasado" é sempre derivado, nunca persistido.**
O campo `status` no banco só aceita `'pendente' | 'pago'`. "Atrasado" é
calculado em tempo de leitura:
```
atrasado = (status === 'pendente') && (due_date < hoje)
```
Nunca gravar `'atrasado'` como valor de `status`. Não criar job/cron para
isso — o cálculo é sempre on-the-fly, na consulta.

**Isolamento entre meses.**
Um item vencido e não pago permanece apenas no mês em que venceu. Não aparece
como lembrete no mês atual nem em meses seguintes. Toda consulta de
`monthly_entries` é filtrada por `month`/`year`, sem lógica cross-month.

**Geração on-demand dos lançamentos mensais.**
Ao consultar `GET /v1/monthly-entries?month=X&year=Y`:
1. Verificar se já existem `monthly_entries` para aquele `user_id`/`month`/`year`
2. Se não existirem, gerar um registro por `recurrence` **ativa**, usando
   `default_amount` como valor inicial
3. Toda a geração roda dentro de `db.transaction()` — se falhar no meio,
   nada é criado parcialmente

**Edição não afeta o template.**
Editar `amount`/`description` de um `monthly_entry` específico nunca altera
`default_amount`/`description` da `recurrence` associada.

**Desativação de recorrência.**
Ao definir `active = false`: deixa de gerar novos `monthly_entries` a partir
do mês da desativação em diante. Lançamentos futuros já gerados **antes** da
desativação não são apagados automaticamente.

**Sincronização entre `monthly_entries` e `transactions`.**
Regra mais sensível do sistema — sempre implementar com `db.transaction()`:
- *Marcar como pago*: cria um registro em `transactions` com os dados do
  `monthly_entry`, preenche `monthly_entries.transaction_id` e
  `status = 'pago'`
- *Desmarcar*: apaga o `transaction` vinculado, limpa `transaction_id`, volta
  `status = 'pendente'`
- *Edição sincronizada*: editar o valor por um dos dois lados atualiza o
  outro automaticamente

**Lançamentos avulsos.**
Um `monthly_entry` sem `recurrence_id` pode ter `type`, `amount`,
`description` e `category_id` editados livremente a qualquer momento.

---

## 6. Persistência

### Convenções gerais

- IDs: **UUID** (não usar serial incremental)
- Valores monetários: **inteiro em centavos** (nunca float/decimal solto)
- Soft delete em `categories` e `recurrences` (campo `deleted_at` — nunca
  excluir de verdade, mantém histórico e integridade referencial)
- Timestamps `created_at` / `updated_at` em todas as tabelas

### Modelagem das tabelas

**`users`**
```
id            uuid, pk
email         text, unique
password_hash text
created_at, updated_at
```

**`categories`**
```
id          uuid, pk
user_id     uuid, fk -> users
name        text
deleted_at  timestamp, nullable
created_at, updated_at
```

**`recurrences`** — template de conta fixa/variável
```
id             uuid, pk
user_id        uuid, fk -> users
category_id    uuid, fk -> categories
description    text
type           text  -- 'despesa' | 'receita'
default_amount integer  -- centavos
due_day        integer  -- dia do mês (1-31)
active         boolean, default true
deleted_at     timestamp, nullable
created_at, updated_at
```

**`monthly_entries`** — instância mensal (planejada/pendente)
```
id              uuid, pk
user_id         uuid, fk -> users
recurrence_id   uuid, fk -> recurrences, nullable  -- null = avulso
category_id     uuid, fk -> categories
transaction_id  uuid, fk -> transactions, nullable -- preenchido quando pago
description     text
type            text  -- 'despesa' | 'receita'
amount          integer  -- centavos (pode divergir do default_amount)
due_date        date
status          text  -- 'pendente' | 'pago' (nunca 'atrasado', ver 5.2)
month           integer  -- 1-12
year            integer
created_at, updated_at
```

**`transactions`** — histórico definitivo, realizado
```
id             uuid, pk
user_id        uuid, fk -> users
category_id    uuid, fk -> categories
description    text
type           text  -- 'despesa' | 'receita'
amount         integer  -- centavos
paid_at        timestamp
created_at, updated_at
```

### Migrations

Toda alteração de schema passa por `drizzle-kit generate` (gera SQL) seguido
de `drizzle-kit migrate` (aplica). Migrations sempre versionadas no Git.

---

## 7. Diretrizes de desenvolvimento

### Versionamento de API

Prefixo global `/v1` em todas as rotas (`app.setGlobalPrefix('v1')` em
`main.ts`).

### Formato de resposta (envelope padronizado)

```json
{
  "data": { },
  "error": null,
  "meta": { }
}
```

Erros seguem o mesmo envelope, com `data: null` e `error` preenchido:
```json
{
  "data": null,
  "error": { "message": "...", "code": "..." },
  "meta": {}
}
```

### Validação

Zod para DTOs, preferindo `drizzle-zod` para derivar validação diretamente
do schema de banco, evitando duplicação de tipos.

### Autenticação

- Access token: curta duração (15min–1h)
- Refresh token: duração longa, armazenado (hash) no banco — permite
  invalidação no logout e detecção de reuso indevido (rotation)
- Nunca colocar dados sensíveis no payload do JWT

### Testes

Não gerar testes automaticamente por enquanto — prioridade é ter as
funcionalidades rodando primeiro. Entram numa fase posterior, sob pedido.

### O que NÃO fazer

- Não persistir status `'atrasado'` no banco
- Não gerar lembrete cross-month de itens atrasados
- Não alterar o template (`recurrence`) ao editar um `monthly_entry`
- Não criar abstrações genéricas de repositório
- Não usar CQRS/microserviços
- Não gerar testes automaticamente sem pedido explícito

---

## 8. Estrutura física

```
backend/
  src/
    auth/
      auth.controller.ts
      auth.service.ts
      dto/
      strategies/          # JWT strategy
    categories/
      categories.controller.ts
      categories.service.ts
      categories.repository.ts
      dto/
    recurrences/
      recurrences.controller.ts
      recurrences.service.ts
      recurrences.repository.ts
      dto/
    monthly-entries/
      monthly-entries.controller.ts
      monthly-entries.service.ts   # geração on-demand + sync c/ transactions
      monthly-entries.repository.ts
      dto/
    transactions/
      transactions.repository.ts   # sem controller próprio por ora
    database/
      schema/
        users.schema.ts
        categories.schema.ts
        recurrences.schema.ts
        monthly-entries.schema.ts
        transactions.schema.ts
      drizzle.module.ts    # provider injetável do client Drizzle
    common/
      guards/              # JwtAuthGuard
      filters/             # exception filter global (formata envelope de erro)
      interceptors/        # response envelope interceptor
      decorators/          # @CurrentUser()
    config/
      env.validation.ts
    main.ts                # prefixo global /v1 configurado aqui
  .env                      # não versionado
  .env.example
  package.json
```
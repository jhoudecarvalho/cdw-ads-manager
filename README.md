# Franchise HUB

SaaS B2B multi-tenant para gestão de campanhas Google Ads + Meta Ads em redes de franquias. Especificação completa em [`docs/PROMPT-Claude-Code-Franchise-HUB.md`](docs/PROMPT-Claude-Code-Franchise-HUB.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript estrito** + **Tailwind v4**
- **Prisma 7** + **PostgreSQL** (dev: Neon)
- **Multi-tenancy** path-based (`/anjos`, `/kgepel`) + **Row-Level Security** do Postgres
- **Vitest** para unit tests; **Playwright** entra na Fase 7

## Setup local

### 1. Pré-requisitos

- Node.js 20+ (testado em 20.20.1; Prisma sugere 22+, mas 20 funciona)
- npm 10+
- Acesso a um Postgres — dev usa **Neon** (free tier), mas trocar para Postgres local é trivial (ver abaixo)

### 2. Instalar dependências

```bash
npm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com sua connection string. Para **Neon**:

- `DATABASE_URL`: URL **com pooler** (`...-pooler.neon.tech/...?pgbouncer=true&connect_timeout=15`) — usada pelo app
- `DIRECT_URL`: URL **sem pooler** — usada pelo Prisma Migrate

Para **Postgres local** (Docker, Postgres.app, etc.):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/franchise_hub?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/franchise_hub?schema=public"
```

Variáveis OAuth (`GOOGLE_ADS_*`, `META_ADS_*`, `NEXTAUTH_*`, `ENCRYPTION_KEY`) só passam a importar a partir das Fases 2 e 5. Podem ficar vazias agora.

### 4. Banco

```bash
npm run db:generate   # gera o Prisma Client
npm run db:migrate    # cria as tabelas (rode quando o schema mudar)
npm run db:seed       # cria os tenants `anjos` e `kgepel`
```

Para abrir o GUI: `npm run db:studio`.

### 5. Dev server

```bash
npm run dev
```

Abrir:

- <http://localhost:3000> — landing com lista dos tenants
- <http://localhost:3000/anjos> — dashboard do tenant `anjos`
- <http://localhost:3000/kgepel> — dashboard do tenant `kgepel`
- <http://localhost:3000/qualquer-coisa> — 404 amigável

## Comandos úteis

| Comando                | O que faz                     |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Dev server (Turbopack)        |
| `npm run build`        | Build de produção             |
| `npm run start`        | Roda o build                  |
| `npm run lint`         | ESLint                        |
| `npm run format`       | Prettier (escreve)            |
| `npm run format:check` | Prettier (só checa)           |
| `npm run typecheck`    | TypeScript em modo `--noEmit` |
| `npm test`             | Vitest (uma rodada)           |
| `npm run test:watch`   | Vitest em watch               |
| `npm run db:migrate`   | Cria/aplica migration         |
| `npm run db:seed`      | Popula tenants exemplo        |
| `npm run db:studio`    | Prisma Studio                 |

## Trocando Neon por Postgres local

1. Edite `.env`: aponte `DATABASE_URL` e `DIRECT_URL` para o Postgres local
2. `npm run db:migrate` — recria o schema
3. `npm run db:seed`

Nenhuma outra alteração no código é necessária.

## Arquitetura — pontos chave

### Multi-tenancy

- Todo path começa com o **slug** do tenant: `/anjos/dashboard`, `/kgepel/franquias`, etc.
- `proxy.ts` (sucessor do middleware no Next 16) valida o **formato** do slug e propaga via header `x-tenant-slug`. Não faz fetch — segue a recomendação do Next.
- `src/app/[slug]/layout.tsx` faz a **lookup real** do tenant no banco. Cacheada por request via `react.cache()`. Tenant inexistente ou suspenso → `notFound()`.
- A partir da **Fase 3**, todo acesso a tabelas de negócio passa pelo helper `withTenantScope(tenantId, callback)` em `src/server/db/tenant-scope.ts`. Ele abre uma transação, define `app.current_tenant_id` (consumido pelas policies de RLS) e executa o callback.

### Convenção: nada de `tenantId` vindo do cliente

O `tenantId` é sempre derivado de **slug do path + sessão do usuário**, no servidor. Nunca um campo enviado pelo browser. Toda rota e Server Action precisa enforçar isso.

### RLS (Fase 3)

A primeira migration que adiciona tabelas com `tenantId` também habilita RLS em cada uma delas e define a policy:

```sql
USING (tenant_id::text = current_setting('app.current_tenant_id', true))
```

Sem `app.current_tenant_id` definido, nenhuma linha é visível. É a camada de defesa do banco contra bug de aplicação.

## Estrutura

```
prisma/
  schema.prisma                # modelos (hoje só Tenant; cresce na Fase 3)
  seed.ts                      # seed dos tenants exemplo
  migrations/                  # versionadas
src/
  env.ts                       # validação Zod das env vars (boot)
  generated/prisma/            # client Prisma gerado (gitignored)
  app/
    layout.tsx                 # root layout (dark theme)
    page.tsx                   # landing com lista de tenants
    not-found.tsx              # 404 global
    [slug]/
      layout.tsx               # resolve tenant ou notFound()
      page.tsx                 # placeholder do dashboard
      not-found.tsx            # 404 quando tenant não existe
  server/
    db/
      prisma.ts                # singleton do PrismaClient
      tenant-scope.ts          # withTenantScope (RLS)
    tenant/
      slug.ts                  # validação pura do slug + reservados
      slug.test.ts             # 16 testes unitários
      resolver.ts              # getTenantBySlug (cache de request)
proxy.ts                       # ex-middleware (Next 16)
```

## Autenticação (Fase 2)

- Auth.js v5 com Credentials provider + JWT (Credentials não permite DB sessions)
- Login e signup **por tenant**: `/{slug}/login`, `/{slug}/signup`
- Cadastro registra aceite versionado de Termos e Política (LGPD) — em `terms_acceptances`
- Guard de sessão em `[slug]/(app)/layout.tsx`: sem sessão → redirect, sessão de outro tenant → redirect
- Função central `can(actor, action, resource)` em `src/server/auth/can.ts` (35 testes unitários)
- Primeiro usuário cadastrado de cada tenant vira ADMIN automaticamente

### Usuários de exemplo (após `npm run db:seed`)

| Tenant | E-mail              | Senha            |
| ------ | ------------------- | ---------------- |
| anjos  | `admin@anjos.test`  | `dev-anjos-123`  |
| kgepel | `admin@kgepel.test` | `dev-kgepel-123` |

## Modelos de negócio + RLS (Fase 3)

11 modelos novos: `Region`, `Franchise`, `AdAccount`, `Campaign`, `CampaignMetricDaily`, `SyncLog`, `AuditLog`, `UserFranchise`, `UserRegion`, enums por plataforma. Soft-delete onde faz sentido, índices em `(tenantId, …)`.

**Row-Level Security**: toda tabela com `tenantId` tem `tenant_isolation` policy (`FOR ALL` com `USING` e `WITH CHECK`) comparando `"tenantId"` com `current_setting('app.current_tenant_id', true)`. Migration: `20260518182000_enable_rls/migration.sql`.

**Role da aplicação separado**: o role default do Neon (`neondb_owner`) vem com `BYPASSRLS = true` e ignora policies. Para enforcement real, criamos `franchise_hub_app` sem BYPASSRLS via `scripts/setup-app-role.ts` (rode uma vez por banco). `DATABASE_URL` usa esse role; `DIRECT_URL` continua com o owner para Migrate.

**Testes de isolamento contra Neon real** (`tests/tenant-isolation.test.ts`):

| Cenário                                   | Resultado         |
| ----------------------------------------- | ----------------- |
| `SELECT` sem `withTenantScope`            | retorna 0 linhas  |
| `SELECT` scoped em A                      | só vê dados de A  |
| `findUnique` por id de B, scoped em A     | retorna `null`    |
| `INSERT` com `tenantId` de B, scoped em A | erro (WITH CHECK) |
| `UPDATE`/`DELETE` cross-tenant            | 0 linhas afetadas |

**Helpers**:

- `withTenantScope(tenantId, callback)` — transação com `set_config` (`src/server/db/tenant-scope.ts`)
- `loadActorContext(session)` — popula `franchiseIds`/`regionIds` para `can()` (`src/server/auth/load-actor.ts`)

**Volume do seed** (default `SEED_FRANCHISES_PER_TENANT=12`):

| Por tenant       | Quantidade                                            |
| ---------------- | ----------------------------------------------------- |
| Regiões          | 5 (Sul, Sudeste, Centro-Oeste, Nordeste, Norte)       |
| Franquias        | 12 (distribuídas pelas regiões, cidades reais por UF) |
| AdAccounts       | 24 (Google + Meta por franquia)                       |
| Campanhas        | 72 (3 por AdAccount)                                  |
| Métricas diárias | 1.008 (14 dias × 72 campanhas)                        |

Para mais volume: `SEED_FRANCHISES_PER_TENANT=150 npm run db:seed`.

## Layout e navegação (Fase 4)

App shell em `[slug]/(app)/layout.tsx`: sidebar colapsável (shadcn/ui + base UI), top bar com filtros e logo dinâmico do tenant. Cor primária do tenant injetada como CSS var `--tenant-primary`. Mobile: sidebar vira sheet ao clicar no trigger.

**Menu** (definido em `src/server/navigation.ts`):

- 📣 **Campanhas Ads** (grupo expansível, default aberto): Visão Geral, Google Ads, Meta Ads, Campanhas, Franquias, Regiões, Performance, Financeiro, Comparativo
- 🦎 Dados Ecocentauro · 🤝 Programa Indicação · 🔄 Sellflux · 🌐 Landing Page — todos com badge **BREVE**

**Filtros do topo (role-aware)** — `src/components/top-bar.tsx` + `filter-bar.tsx`:

| Papel | Plataforma | Região | Franquia |
|---|---|---|---|
| ADMIN | todas | todas do tenant | todas do tenant |
| REGIONAL | todas | só as vinculadas | só dentro de suas regiões |
| FRANCHISEE | todas | (oculto) | só a própria (estático, sem select) |

Estado dos filtros vive na URL (`?platform=GOOGLE_ADS&region=...&franchise=...`) — bookmarkável, compartilhável.

**Visão Geral** já é tela viva:

- 10 KPIs (Investimento, Receita, ROAS, Conversões, Custo/Conv, Impressões, Cliques, CTR, CPC, CPM)
- Gráfico Recharts Investimento vs Receita (14 dias)
- Cards Google Ads vs Meta Ads com share %
- Todos calculados de queries scoped via `withTenantScope`, filtros aplicados, role aware

**Defaults seguros**: se um REGIONAL ou FRANCHISEE forçar um `?region=...` ou `?franchise=...` fora do escopo, a query é forçada para "__forbidden__" → resultado vazio em vez de vazamento.

## Status

- **Fase 1 — Fundação e Multi-tenancy** ✓
- **Fase 2 — Autenticação e Papéis** ✓
- **Fase 3 — Modelos de negócio + RLS** ✓
- **Fase 4 — Layout e navegação** ✓
- Próxima: **Fase 5 — Integrações Google Ads + Meta Ads** (interface comum `AdsProvider`, modo mock primeiro, OAuth por franqueado, sync incremental, cron + "atualizar agora")

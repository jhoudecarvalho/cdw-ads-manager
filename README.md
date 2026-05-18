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

| Papel      | Plataforma | Região           | Franquia                            |
| ---------- | ---------- | ---------------- | ----------------------------------- |
| ADMIN      | todas      | todas do tenant  | todas do tenant                     |
| REGIONAL   | todas      | só as vinculadas | só dentro de suas regiões           |
| FRANCHISEE | todas      | (oculto)         | só a própria (estático, sem select) |

Estado dos filtros vive na URL (`?platform=GOOGLE_ADS&region=...&franchise=...`) — bookmarkável, compartilhável.

**Visão Geral** já é tela viva:

- 10 KPIs (Investimento, Receita, ROAS, Conversões, Custo/Conv, Impressões, Cliques, CTR, CPC, CPM)
- Gráfico Recharts Investimento vs Receita (14 dias)
- Cards Google Ads vs Meta Ads com share %
- Todos calculados de queries scoped via `withTenantScope`, filtros aplicados, role aware

**Defaults seguros**: se um REGIONAL ou FRANCHISEE forçar um `?region=...` ou `?franchise=...` fora do escopo, a query é forçada para "**forbidden**" → resultado vazio em vez de vazamento.

## Integrações de Ads (Fase 5)

**Interface comum** `AdsProvider` em `src/server/ads/provider.ts` — métodos `listCampaigns`, `getDailyMetrics`, `refreshToken`. Adicionar um provedor novo (TikTok, LinkedIn…) é implementar a interface e plugar no factory.

**3 implementações**:

| Provider            | Status     | Uso                                                                     |
| ------------------- | ---------- | ----------------------------------------------------------------------- |
| `MockAdsProvider`   | ✓ completo | dev/CI sem APIs reais — determinístico (mesmas chamadas = mesmos dados) |
| `GoogleAdsProvider` | esqueleto  | precisa de `GOOGLE_ADS_CLIENT_ID/SECRET/DEVELOPER_TOKEN` + impl GAQL    |
| `MetaAdsProvider`   | esqueleto  | precisa de `META_ADS_CLIENT_ID/SECRET` + impl Marketing API             |

Selecionado por `ADS_INTEGRATIONS_MODE=mock|live` no `.env`. `live` sem credenciais dispara `ProviderNotConfiguredError` no boot — falha rápido em vez de quebrar no meio do sync.

**Criptografia em repouso** (`src/server/crypto/tokens.ts`):

- AES-256-GCM, IV aleatório de 96 bits por chamada, auth tag de 128 bits
- Prefixo de versão (`v1:...`) para suportar rotação futura
- Chave em `ENCRYPTION_KEY` (base64 de 32 bytes — `openssl rand -base64 32`)
- 5 testes: round-trip, IV aleatório, anti-tampering, versão desconhecida, null/undefined

**Sync** (`src/server/ads/sync.ts`):

- `syncAccount(tenantId, adAccountId, range?)` — sincroniza uma conta. Cria SyncLog (`RUNNING` → `SUCCESS`/`FAILED`)
- `syncTenant(tenantId, range?)` — itera todas as `AdAccount` ativas do tenant, falha em uma não trava as outras
- **Idempotente**: campanhas por upsert em `(adAccountId, externalId)`, métricas por `deleteMany + createMany` no range — rodar 2x produz o mesmo estado final
- Tudo dentro de `withTenantScope` — RLS protege contra cross-tenant mesmo em bug do orquestrador
- 3 testes contra Neon: primeira execução cria, segunda execução não duplica, `lastSyncAt` avança

**Botão "Atualizar agora"** (`src/components/sync-button.tsx`) — Visão Geral, visível só pra ADMIN. Server action `runSyncAction(slug)` chama `syncTenant`, faz `revalidatePath` e devolve resumo.

**Endpoint de cron** (`/api/cron/sync`):

- Protegido por `Authorization: Bearer ${CRON_SECRET}`
- Loop por todos os tenants ativos
- Resposta JSON com resumo por tenant
- Pode ser plugado em Vercel Cron, GitHub Actions, EasyCron, etc.
- **Em produção** vira o "enfileirador" para BullMQ/Inngest — sequencial fica caro com N tenants

### Quando ativar Google/Meta de verdade

1. Configure `.env` com as credenciais reais (Google: precisa de developer_token aprovado).
2. Mude `ADS_INTEGRATIONS_MODE="live"`.
3. Implemente os 3 métodos em `google-provider.ts` e `meta-provider.ts` (os stubs trazem comentários com os endpoints e shape esperado).
4. Pronto — nenhum outro arquivo precisa mudar.

## Dashboards (Fase 6)

As 9 telas de Campanhas Ads são todas "ao vivo" agora — dados via `withTenantScope` (RLS), filtros do topo aplicados, role-aware:

| Tela            | Conteúdo                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visão Geral** | 10 KPIs + line chart Investimento × Receita + split Google/Meta                                                                             |
| **Google Ads**  | KPIs específicos + tendência diária + distribuição/ROAS por tipo (Search/PMax/Display) + top 10 campanhas                                   |
| **Meta Ads**    | KPIs específicos + tendência + distribuição/ROAS por objetivo (Lead/Tráfego/Engagement) + top 10                                            |
| **Campanhas**   | Tabela completa de todas as campanhas, busca por nome/franquia/tipo, ordenação por 6 colunas, paginação 25/pág                              |
| **Franquias**   | Cards ordenados por ROAS (ranking #01, #02…), KPIs principais, barra de ROAS vs melhor da rede, split visual Google/Meta, busca + paginação |
| **Regiões**     | KPIs gerais + 2 bar charts (invest. e receita por região) + tabela comparativa com share % e linha de totais                                |
| **Performance** | 6 KPIs avançados (taxa conv., receita/clique, CPC/CPM, CTR) + barras de share por tipo de campanha + tabela                                 |
| **Financeiro**  | Custo/receita/lucro/margem/médias diárias + line chart triplo (custo/receita/lucro) — verde se lucro positivo, vermelho se negativo         |
| **Comparativo** | Google vs Meta lado a lado, 7 métricas comparadas com delta % (verde = ganhando, vermelho = perdendo)                                       |

**Loaders** (`src/server/metrics/*.ts`):

- `shared.ts` — `buildMetricWhere/buildCampaignWhere/buildFranchiseWhere` + helpers (`num`, `safeDiv`, `dateSince`)
- `dashboard.ts` (loadOverview), `by-platform.ts` (loadPlatformSlice), `campaigns-list.ts` (loadCampaignsList), `franchise-rankings.ts` (loadFranchiseRankings), `region-summary.ts` (loadRegionSummary), `performance.ts` (loadPerformance), `financial.ts` (loadFinancial), `comparison.ts` (loadComparison)
- Todos respeitam `DashboardFilters` (platform/region/franchise vindos da URL) + escopo do ator

**Componentes reutilizáveis**:

- `LineTrendChart`, `DistributionBarChart`, `OverviewChart` (Recharts via shadcn ChartContainer)
- `KpiCard`, `DashboardHeader` (consistência visual)
- `src/lib/format.ts` (`brl`, `int`, `pct`, `multiplier`, `platformLabel`)
- `src/lib/filters.ts` (`parseDashboardFilters` — normaliza URL → tipo)

**Atenção dev**: funções não cruzam fronteira server → client component. Formatadores ficaram inline nos chart components em vez de prop `formatY` (que quebrava com `Functions cannot be passed directly to Client Components`).

## LGPD, segurança e testes (Fase 7)

### Trilha de auditoria

`AuditLog` ativo, escrito por `recordAudit()` (`src/server/audit/record.ts`). Failsafe — falha de log nunca bloqueia a ação principal do usuário. Plugado em:

| Evento                                   | Onde                    | Metadata                                                     |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `USER_LOGIN` (ok)                        | `src/auth.ts` authorize | `{ ok: true }`                                               |
| `USER_LOGIN` (falha)                     | `src/auth.ts` authorize | `{ ok: false, reason: "unknown_email" \| "wrong_password" }` |
| `USER_SIGNUP`                            | `signupAction`          | `{ role }`                                                   |
| `TERMS_ACCEPTED`                         | `signupAction`          | versões aceitas                                              |
| `AD_ACCOUNT_CONNECTED` (proxy para sync) | `runSyncAction`         | `{ trigger, syncedAccounts, totalMetrics }`                  |
| `DATA_EXPORTED`                          | `/api/lgpd/export`      | —                                                            |
| `DATA_DELETED`                           | `anonymizeUser`         | `{ reason }`                                                 |

Cada linha guarda IP e User-Agent quando dentro de um request context.

### Direitos do titular

- **Exportação (art. 15)** — `GET /api/lgpd/export` retorna JSON com perfil + aceites + vínculos + últimas 1.000 ações de auditoria do próprio usuário, como download attachment.
- **Anonimização (art. 18)** — `POST /api/lgpd/delete-account` com `{ confirm: "EXCLUIR", reason? }`. Atualiza User: email vira `anonymized_{hash}@removed.invalid`, name/passwordHash/lastLoginAt → null, deletedAt setado. Vínculos e auditoria são preservados (integridade), mas sem identificar o titular.
- **Tela `/{slug}/account`** — exibe perfil, histórico de aceites e os dois botões.

### Política de retenção

Cron `/api/cron/retention` (protegido por `Bearer CRON_SECRET`):

| Tabela                   | Retenção | Por quê                                                     |
| ------------------------ | -------- | ----------------------------------------------------------- |
| `sync_logs`              | 90 dias  | Operacional, só serve para debug recente                    |
| `audit_logs`             | 5 anos   | Padrão para auditoria fiscal/regulatória                    |
| `campaign_metrics_daily` | 2 anos   | Histórico + tendência anual; mais que isso vira BI separado |

Iterado por tenant via `withTenantScope` — cada delete só apaga o que está no escopo correto.

### Cabeçalhos de segurança (`next.config.ts`)

- `Content-Security-Policy` (default-src 'self', form-action 'self', frame-ancestors 'none', object-src 'none', …)
- `Strict-Transport-Security` (2 anos + includeSubDomains + preload — só faz efeito sob HTTPS real)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` proibindo câmera/microfone/geolocalização/cohort

### Testes Playwright (e2e)

Suíte mínima em `tests/e2e/auth.spec.ts` cobrindo fluxos críticos contra o dev server:

| #   | Cenário                         | Verifica                               |
| --- | ------------------------------- | -------------------------------------- |
| 1   | Login válido                    | Cai na Visão Geral com header certo    |
| 2   | Login com senha errada          | Mensagem de erro, fica em /login       |
| 3   | Rota autenticada sem sessão     | Redireciona para /login                |
| 4   | Sessão de A acessando rota de B | Redireciona para /B/login (isolamento) |

Rode com `npm run test:e2e`. O Playwright sobe o dev server automaticamente (`webServer` reusa se já tiver porta 3000).

**Total**: 51 testes Vitest (unit + RLS isolation) + 4 testes Playwright (e2e).

## Refino visual (Fase 8) — porte do design `franchise-ads-dashboard.jsx`

Toda a camada visual foi reescrita seguindo o protótipo de design. **A arquitetura (loaders, RLS, auth, rotas, testes) permaneceu intacta** — só componentes UI mudaram.

**Tokens** (`src/app/globals.css`):

| Token | Valor (dark) | Uso |
|---|---|---|
| `--bg` | `#0a0e17` | page background |
| `--surface` | `#111827` | cards |
| `--surface-alt` | `#1a2236` | hover/selects |
| `--accent` | `#22d3ee` (cyan) | brand, KPIs primários |
| `--accent-alt` | `#a78bfa` (purple) | KPIs secundários |
| `--google` | `#4285f4` | Google Ads |
| `--meta` | `#0668e1` | Meta Ads |
| `--success` | `#34d399` | conversões, lucro |
| `--warning` | `#fbbf24` | receita, alertas |
| `--danger` | `#f87171` | custo, negativo |

**Tipografia**: Space Grotesk (sans, 400–700) + JetBrains Mono (labels uppercase).

**Componentes redesenhados**:
- `app-sidebar.tsx` — gradient vertical surface→#0d1220, logo gradiente cyan→purple com inicial do tenant, "Painel Integrado" subtitle, Campanhas Ads expansível com border-left cyan no item ativo, 4 BREVEs com badge amarelo
- `kpi-card.tsx` — gradient surface→surface-alt, emoji watermark 48px no canto top-right (6% opacidade), label mono uppercase, valor 24px extrabold com cor configurável
- `chart-card.tsx` — wrapper consistente para Recharts (title bold + altura interna)
- `coming-soon.tsx` — ícone 88px com drop-shadow, badge "🚧 Em desenvolvimento" amarelo
- `api-info-footer.tsx` — referência dos endpoints Google Ads API v23 + Meta Marketing API v25

**Charts** (Recharts puro com tokens do design):
- `area-trend-chart.tsx` — multi-series com gradient SVG (`<defs>`) e fill esmaecido
- `split-pie-chart.tsx` — donut com inner radius, labels externos, formato configurável via preset string (não função — server→client constraint)
- `region-radar.tsx` — RadarChart de performance por região
- `conversion-bars.tsx` — barras Google vs Meta lado a lado

**Visão Geral nova** (`/{slug}`): 12 KPIs coloridos, AreaChart 14d Investimento Diário (Google+Meta), Donut Split Investimento, BarChart Conversões Diárias, RadarChart Performance por Região.

**`loadOverview` evoluído**: agora retorna `byDay` separado por plataforma (`googleSpend`/`metaSpend`/`googleConv`/`metaConv`) + agregação `byRegion` para o radar — uma única query alimenta os 4 charts.

**Aprendizado importante** já documentado: **funções não atravessam server→client component**. Aconteceu de novo no `SplitPieChart` (prop `format` era função). Solução adotada: presets string (`"currency" | "int"`) — quem decide é o servidor, quem aplica é o cliente.

## Infra & deploy (Fase 9)

Pacote completo pra rodar self-host numa VM Debian + Docker + nginx no host. Detalhes operacionais em [`docs/DEPLOY.md`](docs/DEPLOY.md).

**Imagem Docker** (`Dockerfile`) — multi-stage Debian slim:

| Stage     | Pra que serve                                                                    |
| --------- | -------------------------------------------------------------------------------- |
| `deps`    | `npm ci` completo, base pro builder/ops                                          |
| `builder` | `prisma generate` + `next build` (output `standalone`)                           |
| `runner`  | Imagem de produção mínima — só `.next/standalone` + `public` + `.next/static`, usuário não-root, HEALTHCHECK em `/api/health` |
| `ops`     | Imagem irmã com `tsx` + Prisma CLI — usada pelo container one-shot `bootstrap` (migrate + role + seed) |

`next.config.ts` ganhou `output: "standalone"` — o `runner` roda o `server.js` próprio do Next, sem precisar de `node_modules` inteiro.

**`/api/health`** — `SELECT 1` no Postgres + JSON `{status, db, latencyMs}`. 200 ou 503. Usado pelo HEALTHCHECK do container e pelo nginx.

**Compose**:

- `compose.yaml` — dev local. Sobe só `postgres` (`docker compose up -d postgres`) pra ter alternativa ao Neon, ou app completo com `--profile full`.
- `compose.prod.yaml` — self-host. App escutando em `127.0.0.1:3000` (só nginx do host alcança), Postgres sem porta exposta no host, volume nomeado pro DB, healthchecks com `depends_on: service_healthy`. Serviço `bootstrap` no profile `ops` pra `migrate deploy + setup-app-role + seed?`.

**`scripts/bootstrap.sh`** — primeira inicialização (e re-runs idempotentes): aguarda Postgres, aplica migrations, garante role `franchise_hub_app` sem BYPASSRLS, seed opcional via `--seed`.

**`.env.example`** — adicionado `PORT`/`HOSTNAME`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (multi-instância), `POSTGRES_*` (consumidas pelo compose). Comentários explicam o que muda em prod (`AUTH_TRUST_HOST=true`, etc.).

**`DEPLOY.md`** — passo a passo end-to-end: install Docker/nginx/certbot no Debian, clone + `.env`, build, bootstrap, nginx server block com `proxy_pass` + headers `X-Forwarded-*`, certbot pra Let's Encrypt, backup com `pg_dump` via cron, restore, rotação de segredos, troubleshooting, checklist de go-live.

## Status

- **Fase 1 — Fundação e Multi-tenancy** ✓
- **Fase 2 — Autenticação e Papéis** ✓
- **Fase 3 — Modelos de negócio + RLS** ✓
- **Fase 4 — Layout e navegação** ✓
- **Fase 5 — Integrações Google + Meta Ads** ✓
- **Fase 6 — Dashboards** ✓
- **Fase 7 — LGPD, segurança e testes** ✓
- **Fase 8 — Refino visual** ✓ (porte fiel do `franchise-ads-dashboard.jsx`)
- **Fase 9 — Infra & deploy** ✓ (Docker multi-stage + compose self-host Debian + nginx + bootstrap)

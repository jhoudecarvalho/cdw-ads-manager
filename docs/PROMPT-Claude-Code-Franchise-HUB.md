# Prompt para Claude Code — Franchise HUB (SaaS Multi-Tenant)

> **Como usar:** copie tudo a partir de "INÍCIO DO PROMPT" e cole no Claude Code. Ele vai ler a especificação inteira, fazer um plano por etapas e começar a construir. Você pode pedir ajustes a qualquer momento.

---

## INÍCIO DO PROMPT

Você vai construir, do zero, um SaaS B2B multi-tenant chamado **Franchise HUB** — uma plataforma de gestão e análise de campanhas de anúncios para redes de franquias. Leia a especificação completa abaixo. **Antes de escrever qualquer código, monte um plano de implementação dividido em fases e me apresente para aprovação.** Implemente fase por fase, com commits pequenos e descritivos.

---

### 1. Visão geral do produto

O Franchise HUB integra **Google Ads** e **Meta Ads** para que franqueadoras e seus franqueados acompanhem campanhas, custos e performance num painel único. O cliente do SaaS é a **franqueadora** (o tenant). Cada franqueadora tem várias **franquias** (até 300+ por tenant), e cada franquia roda campanhas nas duas plataformas.

O produto é vendido como SaaS. Cada tenant é acessado por um path próprio:

```
app.cdwtech.com.br/anjos
app.cdwtech.com.br/kgepel
```

O slug (`anjos`, `kgepel`) identifica o tenant e deve ser resolvido logo no início de cada request.

---

### 2. Stack técnica (decidida)

- **Framework:** Next.js (App Router, versão estável mais recente), TypeScript em modo estrito.
- **Banco:** PostgreSQL.
- **ORM:** Prisma.
- **Multi-tenancy:** schema único compartilhado com coluna `tenant_id` em todas as tabelas de negócio + **Row-Level Security (RLS)** nativo do Postgres como camada de defesa no próprio banco.
- **Autenticação:** NextAuth.js / Auth.js, com adapter do Prisma, sessão e usuários no nosso banco.
- **UI:** React + Tailwind CSS. Componentes acessíveis (Radix UI ou shadcn/ui).
- **Gráficos:** Recharts.
- **Sincronização de dados:** híbrida — job agendado (cron) + botão de "Atualizar agora" sob demanda.
- **Validação:** Zod em todas as bordas (forms, API, env vars).
- **Testes:** Vitest (unit) + Playwright (e2e), com foco em testes de isolamento entre tenants.

Use as escolhas acima como base, mas se identificar uma prática claramente melhor em algum ponto, **aponte a alternativa e justifique antes de seguir**.

---

### 3. Arquitetura multi-tenant — requisitos críticos

1. **Resolução de tenant:** um middleware do Next.js lê o primeiro segmento do path (`/anjos`), busca o tenant correspondente e injeta o `tenantId` no contexto do request. Slug inexistente → página 404 amigável.
2. **Isolamento por RLS:** toda tabela de negócio tem `tenant_id`. Habilite RLS no Postgres com policies que filtram por uma variável de sessão (`app.current_tenant_id`), definida no início de cada transação. Mesmo um bug numa query não pode vazar dados entre tenants.
3. **Camada de acesso a dados:** nenhuma rota chama o Prisma diretamente. Crie um helper (`getTenantPrisma(tenantId)`) que abre a conexão, define a variável de sessão do RLS e devolve o client já "escopado". Toda query passa por ele.
4. **Nada de tenant vindo do cliente sem validação:** o `tenantId` sempre vem do servidor (sessão + slug), nunca de um campo enviado pelo browser.
5. **Testes de isolamento são obrigatórios:** crie testes automatizados que provam que o usuário do tenant A não consegue ler, alterar nem deletar dado do tenant B, em todas as rotas.

---

### 4. Modelo de dados (entidades principais)

Modele com Prisma, todas as tabelas de negócio com `tenantId`, `createdAt`, `updatedAt` e soft-delete (`deletedAt`) onde fizer sentido:

- **Tenant** — `id`, `slug` (único), `name`, `status`, plano/assinatura, branding (logo, cor primária).
- **User** — `id`, `tenantId`, `email`, `name`, `role`, `passwordHash` (ou login social), `lastLoginAt`.
- **Role / Permissões** — três níveis: `ADMIN` (matriz, vê tudo do tenant), `REGIONAL` (vê uma ou mais regiões), `FRANCHISEE` (vê só a própria franquia). Modele de forma que o vínculo usuário→franquia e usuário→região seja explícito.
- **Region** — `id`, `tenantId`, `name` (Sul, Sudeste, Centro-Oeste, Nordeste, Norte).
- **Franchise** — `id`, `tenantId`, `regionId`, `name`, `state` (UF), `city`, `status`.
- **AdAccount** — conta de anúncio conectada via OAuth. `id`, `tenantId`, `franchiseId`, `platform` (`GOOGLE_ADS` | `META_ADS`), `externalAccountId`, `accessToken` e `refreshToken` **criptografados em repouso**, `tokenExpiresAt`, `status`.
- **Campaign** — `id`, `tenantId`, `franchiseId`, `adAccountId`, `platform`, `externalId`, `name`, `type`/`objective`, `status`.
- **CampaignMetricDaily** — métricas por campanha por dia (para séries temporais): `date`, `spend`, `impressions`, `clicks`, `conversions`, `conversionValue`, `reach`, `frequency`, e campos específicos por plataforma (quality score, link clicks, leads, video views, engagement etc.).
- **SyncLog** — registro de cada sincronização: `platform`, `startedAt`, `finishedAt`, `status`, `recordsProcessed`, `error`.
- **AuditLog** — trilha de auditoria para LGPD (ver seção 8).

---

### 5. Integrações com APIs de anúncios

**Fluxo de conexão:** OAuth — **cada franqueado conecta a própria conta**. Na área da franquia existe um botão "Conectar Google Ads" e "Conectar Meta Ads" que inicia o fluxo OAuth, e ao final salva a `AdAccount` com os tokens criptografados.

**Google Ads:** integrar via Google Ads API. Puxar campanhas e métricas diárias (impressions, clicks, cost_micros, conversions, conversions_value, ctr, average_cpc, average_cpm, cost_per_conversion, search_impression_share, video_views etc.).

**Meta Ads:** integrar via Meta Marketing API. Puxar campanhas e insights diários (impressions, reach, frequency, clicks, link_clicks, spend, cpm, cpc, actions, action_values, video_views, leads, engagement etc.).

**Requisitos da camada de integração:**

- Isole cada provider atrás de uma interface comum (ex.: `AdsProvider` com métodos `listCampaigns`, `getDailyMetrics`, `refreshToken`), para que adicionar uma terceira plataforma no futuro não quebre nada.
- Refresh automático de token expirado.
- Respeito a rate limits, com retry e backoff exponencial.
- Sincronização **incremental** (só o que mudou desde o último sync), idempotente — rodar duas vezes não duplica dado.
- Toda chamada e resultado registrados em `SyncLog`.
- **Cron** roda o sync periodicamente (parametrizável, ex.: a cada 3–6h); o **botão "Atualizar agora"** dispara o mesmo job sob demanda, com feedback de progresso na UI.

---

### 6. Níveis de usuário e permissões

Três papéis, todos dentro do escopo de um tenant:

- **ADMIN (matriz):** vê tudo do tenant — todas as franquias, todas as regiões, todos os dados consolidados. Gerencia usuários, convida franqueados, define regiões.
- **REGIONAL (gestor regional):** vê apenas as franquias das regiões a que está vinculado.
- **FRANCHISEE (franqueado):** vê apenas a própria franquia e suas campanhas; conecta as próprias contas de anúncio.

A autorização deve ser checada **no servidor** em toda rota e query — nunca apenas escondendo botões na UI. Centralize as regras (ex.: uma função `can(user, action, resource)`).

---

### 7. Funcionalidades e layout do painel

Replique a estrutura e a experiência do protótipo já validado. O sistema usa um **menu lateral**. Item de menu principal:

**📣 Campanhas Ads** — item expansível, contém todos os submenus abaixo:

1. **Visão Geral** — KPIs consolidados (investimento, impressões, cliques, conversões, receita, ROAS, CTR, CPC, CPM, custo/conversão, alcance, frequência), gráfico de investimento diário (30 dias), split de investimento Google vs Meta, conversões diárias, radar de performance por região.
2. **Google Ads** — KPIs e gráficos específicos do Google, performance por tipo de campanha, ROAS por tipo, tabela de campanhas.
3. **Meta Ads** — KPIs e gráficos específicos do Meta (alcance, leads, video views, engajamento), investimento por objetivo, tabela de campanhas.
4. **Campanhas** — tabela completa de todas as campanhas das duas plataformas, com busca e ordenação.
5. **Franquias** — visão em **cards por franquia**: cada card mostra ranking por ROAS, KPIs principais (investimento, receita, ROAS, conversões, cliques, CTR), barra visual de ROAS, split Google vs Meta, e ao expandir mostra métricas detalhadas + lista de campanhas daquela franquia. Com busca e paginação.
6. **Regiões** — comparativo de performance entre as regiões, cards por região e gráficos.
7. **Performance** — indicadores avançados (taxa de conversão, receita por clique, distribuição por tipo de campanha).
8. **Financeiro** — custo total, receita, lucro bruto, margem, custo/dia, receita/dia, gráfico investimento vs receita.
9. **Comparativo** — Google Ads vs Meta Ads lado a lado em todas as métricas.

**Itens de menu adicionais (placeholders, marcados como "BREVE"):**

- 🦎 **Dados Ecocentauro** — BREVE
- 🤝 **Programa Indicação** — BREVE
- 🔄 **Sellflux** — BREVE
- 🌐 **Landing Page** — BREVE

Cada um abre uma tela "em desenvolvimento — disponível em breve", já preparada para receber a integração futura. A arquitetura de navegação e de rotas deve tornar trivial transformar um placeholder num módulo completo.

**Identidade visual:** tema escuro, layout idêntico ao protótipo. O **logo no topo da sidebar é dinâmico por tenant** (cada franqueadora tem seu logo e cor primária no cadastro do Tenant). Filtros no topo: plataforma, região e franquia (visíveis conforme o papel do usuário). Seletor de nível de acesso/perfil.

**Responsividade:** o painel deve funcionar bem em desktop e em telas menores.

---

### 8. LGPD e segurança — requisitos obrigatórios

O sistema processa dados pessoais e precisa nascer em conformidade com a **LGPD**:

- **Base legal e consentimento:** registrar aceite de Termos de Uso e Política de Privacidade no cadastro, com data e versão do documento.
- **Minimização:** coletar apenas o dado necessário. Não armazenar dado pessoal sem finalidade clara.
- **Criptografia:** tokens de OAuth e qualquer segredo criptografados em repouso; todo tráfego em HTTPS.
- **Trilha de auditoria (`AuditLog`):** registrar quem acessou/alterou o quê e quando, especialmente dados sensíveis e ações administrativas.
- **Direitos do titular:** prever endpoints/telas para **exportar** os dados de um usuário e para **excluir/anonimizar** uma conta a pedido.
- **Retenção:** definir política de retenção e expurgo de dados antigos (logs, métricas).
- **Controle de acesso:** princípio do menor privilégio em todos os papéis.
- **Segredos:** nada de credencial hardcoded; tudo em variáveis de ambiente, validadas com Zod no boot.
- **Isolamento de tenant** já tratado na seção 3 — é também um requisito de privacidade.
- Incluir cabeçalhos de segurança (CSP, HSTS etc.) e proteção contra CSRF, XSS e SQL injection (o Prisma já ajuda, mas valide as entradas).

---

### 9. Escalabilidade e boas práticas

- **Banco:** índices em `tenant_id` e nas colunas mais consultadas (`franchiseId`, `date`, `platform`); a tabela de métricas diárias tende a crescer muito — considere particionamento por data se necessário.
- **Performance da UI:** paginação e/ou virtualização em listas grandes (300+ franquias, milhares de campanhas); agregações pesadas calculadas no banco, não no browser.
- **Cache:** cache de leituras de dashboard com invalidação após cada sync.
- **Jobs:** a sincronização roda em background (fila de jobs), nunca bloqueando o request do usuário; jobs idempotentes e observáveis via `SyncLog`.
- **Configuração por ambiente:** dev, staging e produção separados; migrations versionadas via Prisma Migrate.
- **Observabilidade:** logging estruturado, tratamento de erro consistente, monitoramento de falhas de sync.
- **Qualidade:** TypeScript estrito, ESLint + Prettier, organização clara de pastas (separar domínio, infraestrutura, UI), código comentado onde a regra de negócio for sutil.
- **Seed:** script de seed que cria 2 tenants de exemplo (`anjos`, `kgepel`), regiões, ~300 franquias fictícias, campanhas e métricas, para desenvolver e testar sem depender das APIs reais. Crie também um modo "mock" das integrações para rodar tudo offline.

---

### 10. Entregáveis e forma de trabalhar

1. Comece apresentando um **plano de implementação em fases** (sugestão: Fase 1 — fundação do projeto e multi-tenancy; Fase 2 — auth e papéis; Fase 3 — modelo de dados e RLS; Fase 4 — layout e navegação; Fase 5 — integrações de Ads; Fase 6 — dashboards; Fase 7 — LGPD, auditoria e testes; Fase 8 — placeholders e refino). Espere minha aprovação do plano antes de codar.
2. Implemente fase por fase. Ao fim de cada fase, resuma o que foi feito, como testar, e o que vem na próxima.
3. Inclua um `README.md` com setup local, variáveis de ambiente necessárias, como rodar migrations, seed e testes.
4. Use commits pequenos e mensagens claras.
5. Sempre que uma decisão de arquitetura tiver trade-offs relevantes, **me explique as opções em linguagem simples antes de decidir**.
6. Não exponha segredos, não pule os testes de isolamento de tenant e não use dados reais em desenvolvimento.

Quando entender tudo, comece pelo **plano de implementação em fases**.

## FIM DO PROMPT

---

## Notas para você (não cole no Claude Code)

- **Domínio/path:** o prompt já contempla o formato `app.cdwtech.com.br/{slug}`. Se um dia quiser migrar para subdomínio (`anjos.cdwtech.com.br`), a resolução de tenant no middleware muda pouco — vale comentar com o Claude Code quando chegar lá.
- **Custos de API:** Google Ads e Meta exigem aprovação de aplicativo e, no caso do Google, um _developer token_. Comece pelo modo "mock" das integrações (já pedido no prompt) e conecte as APIs reais depois que a estrutura estiver de pé.
- **OAuth por franqueado:** como cada franqueado conecta a própria conta, você vai precisar registrar um app OAuth no Google e no Meta e configurar as URLs de callback. O Claude Code vai te pedir essas credenciais — guarde-as só em variáveis de ambiente.
- **Próximos módulos:** Ecocentauro, Programa de Indicação, Sellflux e Landing Page entram como placeholders agora; quando forem especificados, peça ao Claude Code para transformar o placeholder em módulo completo.
- **Sugestão:** rode o projeto no Claude Code dentro de um repositório Git desde o primeiro commit, e peça que ele configure CI rodando lint + testes a cada push.

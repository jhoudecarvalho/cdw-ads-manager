import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Platform,
  type Prisma,
  type TenantType,
} from "../src/generated/prisma/client";
import { DOCUMENT_VERSIONS } from "../src/server/auth/terms";

/**
 * Seed idempotente — pode rodar quantas vezes quiser.
 *
 * Cobertura:
 *   - 3 tenants de exemplo + 1 super admin no tenant técnico `system`
 *     - `anjos`, `clickvel` → FRANCHISE (modo Region → Franchise)
 *     - `kgepel`            → COMPANY (modo Empresas planas)
 *   - 1 ADMIN por tenant (senhas previsíveis só para dev)
 *
 *   Em modo FRANCHISE:
 *     - 5 regiões oficiais brasileiras por tenant
 *     - N franquias (default 12; ajuste com SEED_FRANCHISES_PER_TENANT)
 *     - 2 AdAccount por franquia (Google + Meta) mockados
 *     - 3 campanhas por AdAccount, 14 dias de métricas
 *
 *   Em modo COMPANY:
 *     - 8 empresas baseadas no protótipo
 *     - 2 AdAccount por empresa (Google + Meta) mockados
 *     - 3 campanhas por AdAccount, 14 dias de métricas
 *     - `TenantCounter` ajustado para continuar a sequência (EMP-0009 a próxima)
 *
 * Como RLS está ativa, todas as operações em tabelas de negócio rodam dentro
 * de `withTenantScope` (replicado aqui via $transaction + set_config).
 */

const FRANCHISES_PER_TENANT = Number(
  process.env.SEED_FRANCHISES_PER_TENANT ?? 12,
);
const METRIC_DAYS = 14;

const REGIONS = [
  { name: "Sul", states: ["RS", "SC", "PR"] },
  { name: "Sudeste", states: ["SP", "RJ", "MG", "ES"] },
  { name: "Centro-Oeste", states: ["GO", "MT", "MS", "DF"] },
  {
    name: "Nordeste",
    states: ["BA", "PE", "CE", "PB", "RN", "AL", "SE", "MA", "PI"],
  },
  { name: "Norte", states: ["AM", "PA", "RO", "AC", "AP", "RR", "TO"] },
] as const;

const CITY_BY_STATE: Record<string, string> = {
  RS: "Porto Alegre",
  SC: "Florianópolis",
  PR: "Curitiba",
  SP: "São Paulo",
  RJ: "Rio de Janeiro",
  MG: "Belo Horizonte",
  ES: "Vitória",
  GO: "Goiânia",
  MT: "Cuiabá",
  MS: "Campo Grande",
  DF: "Brasília",
  BA: "Salvador",
  PE: "Recife",
  CE: "Fortaleza",
  PB: "João Pessoa",
  RN: "Natal",
  AL: "Maceió",
  SE: "Aracaju",
  MA: "São Luís",
  PI: "Teresina",
  AM: "Manaus",
  PA: "Belém",
  RO: "Porto Velho",
  AC: "Rio Branco",
  AP: "Macapá",
  RR: "Boa Vista",
  TO: "Palmas",
};

type SeedTenant = {
  slug: string;
  name: string;
  tenantType: TenantType;
  primaryColor: string;
  logoUrl: string | null;
  admin: { email: string; name: string; password: string };
};

const TENANTS: readonly SeedTenant[] = [
  {
    slug: "anjos",
    name: "Anjos Programa",
    tenantType: "FRANCHISE",
    primaryColor: "#7C3AED",
    logoUrl: null,
    admin: {
      email: "admin@anjos.test",
      name: "Admin Anjos",
      password: "dev-anjos-123",
    },
  },
  {
    slug: "kgepel",
    name: "K-Gépel",
    tenantType: "COMPANY",
    primaryColor: "#0EA5E9",
    logoUrl: null,
    admin: {
      email: "admin@kgepel.test",
      name: "Admin K-Gépel",
      password: "dev-kgepel-123",
    },
  },
  {
    slug: "clickvel",
    name: "Clickvel",
    tenantType: "FRANCHISE",
    primaryColor: "#7C3AED",
    logoUrl:
      "https://clickvel.com.br/wp-content/uploads/2025/11/logonova.png.webp",
    admin: {
      email: "admin@clickvel.test",
      name: "Admin Clickvel",
      password: "dev-clickvel-123",
    },
  },
];

/**
 * Empresas iniciais para tenants COMPANY (carteira modelo da KGEPEL — vindas
 * do protótipo `remixed-275d2e63 (1).tsx`).
 */
const COMPANY_FIXTURES: ReadonlyArray<{
  externalCode: string;
  name: string;
  sector: string;
  cnpj: string;
  contactEmail: string;
  status: "ACTIVE" | "INACTIVE";
}> = [
  {
    externalCode: "EMP-0001",
    name: "Padaria Trigo Dourado",
    sector: "Alimentação",
    cnpj: "12.345.678/0001-90",
    contactEmail: "contato@trigodourado.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0002",
    name: "Clínica Vida Plena",
    sector: "Saúde",
    cnpj: "23.456.789/0001-01",
    contactEmail: "marketing@vidaplena.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0003",
    name: "AutoPeças Veloz",
    sector: "Varejo",
    cnpj: "34.567.890/0001-12",
    contactEmail: "ads@autoveloz.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0004",
    name: "Studio Movimento",
    sector: "Serviços",
    cnpj: "45.678.901/0001-23",
    contactEmail: "studio@movimento.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0005",
    name: "TechNova Soluções",
    sector: "Tecnologia",
    cnpj: "56.789.012/0001-34",
    contactEmail: "growth@technova.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0006",
    name: "Colégio Horizonte",
    sector: "Educação",
    cnpj: "67.890.123/0001-45",
    contactEmail: "captacao@horizonte.edu",
    status: "INACTIVE",
  },
  {
    externalCode: "EMP-0007",
    name: "Imobiliária Lar Certo",
    sector: "Imobiliário",
    cnpj: "78.901.234/0001-56",
    contactEmail: "leads@larcerto.com",
    status: "ACTIVE",
  },
  {
    externalCode: "EMP-0008",
    name: "Metalúrgica Forte",
    sector: "Indústria",
    cnpj: "89.012.345/0001-67",
    contactEmail: "comercial@metalforte.com",
    status: "ACTIVE",
  },
];

const CAMPAIGN_TYPES_GOOGLE = ["SEARCH", "PERFORMANCE_MAX", "DISPLAY"] as const;
const CAMPAIGN_TYPES_META = [
  "LEAD_GENERATION",
  "TRAFFIC",
  "ENGAGEMENT",
] as const;

/** PRNG determinístico para volumes consistentes entre runs (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function withScope<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    { timeout: 60_000 },
  );
}

async function seedTenant(prisma: PrismaClient, t: SeedTenant) {
  // Tenant é "global" — sem RLS.
  const tenant = await prisma.tenant.upsert({
    where: { slug: t.slug },
    update: {
      name: t.name,
      tenantType: t.tenantType,
      primaryColor: t.primaryColor,
      logoUrl: t.logoUrl,
    },
    create: {
      slug: t.slug,
      name: t.name,
      tenantType: t.tenantType,
      primaryColor: t.primaryColor,
      logoUrl: t.logoUrl,
    },
    select: { id: true, slug: true, tenantType: true },
  });
  console.log(`✓ tenant ${tenant.slug} (${tenant.id}) [${tenant.tenantType}]`);

  const adminHash = await bcrypt.hash(t.admin.password, 12);

  await withScope(prisma, tenant.id, async (tx) => {
    // --- Admin ---
    const existingAdmin = await tx.user.findFirst({
      where: { email: t.admin.email },
      select: { id: true },
    });
    if (existingAdmin) {
      await tx.user.update({
        where: { id: existingAdmin.id },
        data: { name: t.admin.name, passwordHash: adminHash, role: "ADMIN" },
      });
      console.log(`  ↻ admin ${t.admin.email} atualizado`);
    } else {
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: t.admin.email,
          name: t.admin.name,
          passwordHash: adminHash,
          role: "ADMIN",
          termsAcceptances: {
            create: [
              {
                tenantId: tenant.id,
                documentKey: "terms_of_use",
                version: DOCUMENT_VERSIONS.terms_of_use,
              },
              {
                tenantId: tenant.id,
                documentKey: "privacy_policy",
                version: DOCUMENT_VERSIONS.privacy_policy,
              },
            ],
          },
        },
      });
      console.log(`  + admin ${t.admin.email} (senha: ${t.admin.password})`);
    }

    // Seed determinístico por slug — mantém o volume estável entre runs.
    const slugSeed = Array.from(tenant.slug).reduce(
      (acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0,
      0,
    );
    const rand = rng(slugSeed);

    // Recria ads/campanhas/métricas só se não houver sync_logs — caso
    // contrário pula. Critério barato: se já existe sync_logs DESTE tenant,
    // assumimos seed completo desta seção.
    let syncCount = await tx.syncLog.count({
      where: { tenantId: tenant.id },
    });
    let seedAds = syncCount === 0;

    // -----------------------------------------------------------------------
    // Estrutura organizacional — ramifica por tenantType
    // -----------------------------------------------------------------------
    type UnitRef = { id: string; tag: string };
    const units: UnitRef[] = [];

    if (t.tenantType === "FRANCHISE") {
      // --- Regiões ---
      for (const r of REGIONS) {
        await tx.region.upsert({
          where: { tenantId_name: { tenantId: tenant.id, name: r.name } },
          update: {},
          create: { tenantId: tenant.id, name: r.name },
        });
      }
      // Filtro explícito por tenantId — defensivo. O seed roda como
      // `neondb_owner` (BYPASSRLS), então não dá pra confiar só na policy.
      const regions = await tx.region.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true },
      });
      const regionByName = new Map(regions.map((r) => [r.name, r.id]));
      console.log(`  + ${regions.length} regiões`);

      // --- Franquias ---
      let franchisesCreated = 0;
      for (let i = 1; i <= FRANCHISES_PER_TENANT; i++) {
        const region = REGIONS[(i - 1) % REGIONS.length]!;
        const regionId = regionByName.get(region.name)!;
        const state = pick(rand, region.states);
        const city = CITY_BY_STATE[state] ?? "Cidade Desconhecida";
        const code = String(i).padStart(3, "0");
        const name = `${t.name} ${code} — ${city}`;

        const existing = await tx.franchise.findFirst({
          where: { tenantId: tenant.id, name },
          select: { id: true },
        });
        if (existing) continue;

        await tx.franchise.create({
          data: {
            tenantId: tenant.id,
            regionId,
            name,
            state,
            city,
            status: "ACTIVE",
          },
        });
        franchisesCreated++;
      }
      if (franchisesCreated > 0) {
        console.log(`  + ${franchisesCreated} franquias`);
      } else {
        console.log(`  ↻ franquias já existem (${FRANCHISES_PER_TENANT})`);
      }

      const allFranchises = await tx.franchise.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true },
      });
      for (const f of allFranchises) {
        units.push({ id: f.id, tag: `frq-${f.id.slice(-6)}` });
      }
    } else {
      // --- Empresas (modo COMPANY) ---

      // Defensivo: se este tenant já teve dados de FRANCHISE (mudança de
      // modo entre runs do seed), apaga franchises/regions e seus
      // dependentes via CASCADE. Sem isso, AdAccount/Campaign apontando
      // para franchiseId continuariam vivos paralelos às empresas.
      const legacyFranchises = await tx.franchise.count({
        where: { tenantId: tenant.id },
      });
      if (legacyFranchises > 0) {
        // SALVAGUARDA: em produção nunca apagar dados sem confirmação
        // explícita. Se o tenant existe como FRANCHISE em prod e o seed
        // tentaria transformar em COMPANY, abortar com mensagem clara —
        // o operador deve decidir manualmente (UPDATE direto + cleanup).
        if (
          process.env.NODE_ENV === "production" &&
          process.env.SEED_FORCE_DESTRUCTIVE !== "1"
        ) {
          throw new Error(
            `[seed] tenant ${tenant.slug} tem ${legacyFranchises} franquias e está sendo marcado como COMPANY. ` +
              `Em produção isso APAGARIA franchises/regions/adAccounts/campaigns. ` +
              `Resolva manualmente ou exporte SEED_FORCE_DESTRUCTIVE=1 se for proposital.`,
          );
        }
        // Ordem importa por causa das FKs SET NULL/CASCADE — apagamos os
        // sync_logs primeiro (FK SET NULL em adAccount), depois adAccounts
        // (CASCADE em campaigns/metrics), por fim franchises e regions.
        await tx.syncLog.deleteMany({ where: { tenantId: tenant.id } });
        await tx.adAccount.deleteMany({
          where: { tenantId: tenant.id, franchiseId: { not: null } },
        });
        await tx.franchise.deleteMany({ where: { tenantId: tenant.id } });
        await tx.region.deleteMany({ where: { tenantId: tenant.id } });
        console.log(
          `  ⚠ migrou de FRANCHISE → COMPANY: removeu ${legacyFranchises} franquias legadas`,
        );
        // Após o cleanup, força reaplicar o seed de ads para empresas.
        syncCount = 0;
        seedAds = true;
      }

      let companiesCreated = 0;
      for (const co of COMPANY_FIXTURES) {
        const existing = await tx.company.findFirst({
          where: { tenantId: tenant.id, externalCode: co.externalCode },
          select: { id: true },
        });
        if (existing) continue;
        await tx.company.create({
          data: {
            tenantId: tenant.id,
            externalCode: co.externalCode,
            name: co.name,
            sector: co.sector,
            cnpj: co.cnpj,
            contactEmail: co.contactEmail,
            status: co.status,
          },
        });
        companiesCreated++;
      }
      if (companiesCreated > 0) {
        console.log(`  + ${companiesCreated} empresas`);
      } else {
        console.log(`  ↻ empresas já existem (${COMPANY_FIXTURES.length})`);
      }

      // Avança o counter para que próximos cadastros pela UI continuem a
      // sequência (EMP-0009...). Upsert idempotente.
      await tx.tenantCounter.upsert({
        where: {
          tenantId_kind: { tenantId: tenant.id, kind: "company" },
        },
        update: { value: COMPANY_FIXTURES.length },
        create: {
          tenantId: tenant.id,
          kind: "company",
          value: COMPANY_FIXTURES.length,
        },
      });

      const allCompanies = await tx.company.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, externalCode: true },
      });
      for (const c of allCompanies) {
        units.push({ id: c.id, tag: `emp-${c.id.slice(-6)}` });
      }
    }

    if (!seedAds) {
      console.log(`  ↻ ad accounts/campanhas já existem — pulando`);
      return;
    }

    // -----------------------------------------------------------------------
    // AdAccounts + Campaigns + Métricas — comuns aos dois modos
    // -----------------------------------------------------------------------
    const platforms: Platform[] = ["GOOGLE_ADS", "META_ADS"];
    let adAccountsCreated = 0;
    let campaignsCreated = 0;
    let metricsCreated = 0;

    for (const u of units) {
      for (const platform of platforms) {
        const account = await tx.adAccount.create({
          data: {
            tenantId: tenant.id,
            // Polimorfismo: passa o id no campo correto conforme o tipo.
            ...(t.tenantType === "FRANCHISE"
              ? { franchiseId: u.id }
              : { companyId: u.id }),
            platform,
            externalAccountId: `mock-${platform.toLowerCase()}-${u.id.slice(-6)}`,
            status: "CONNECTED",
            lastSyncAt: new Date(),
          },
        });
        adAccountsCreated++;

        const types =
          platform === "GOOGLE_ADS"
            ? CAMPAIGN_TYPES_GOOGLE
            : CAMPAIGN_TYPES_META;
        for (let c = 0; c < 3; c++) {
          const type = types[c % types.length]!;
          const campaign = await tx.campaign.create({
            data: {
              tenantId: tenant.id,
              ...(t.tenantType === "FRANCHISE"
                ? { franchiseId: u.id }
                : { companyId: u.id }),
              adAccountId: account.id,
              platform,
              externalId: `ext-${account.id.slice(-6)}-${c}`,
              name: `${type} #${c + 1}`,
              type,
              status: "ACTIVE",
            },
          });
          campaignsCreated++;

          // Métricas diárias (últimos METRIC_DAYS dias).
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const rows: Prisma.CampaignMetricDailyCreateManyInput[] = [];
          for (let d = METRIC_DAYS - 1; d >= 0; d--) {
            const date = new Date(today);
            date.setUTCDate(today.getUTCDate() - d);
            const spend = 50 + rand() * 950; // R$ 50–1000/dia
            const impressions = Math.floor(500 + rand() * 9500);
            const clicks = Math.floor(impressions * (0.005 + rand() * 0.04));
            const conversions = clicks * (0.01 + rand() * 0.08);
            const conversionValue = conversions * (40 + rand() * 200);
            rows.push({
              tenantId: tenant.id,
              campaignId: campaign.id,
              date,
              spend: spend.toFixed(2),
              impressions,
              clicks,
              conversions: conversions.toFixed(4),
              conversionValue: conversionValue.toFixed(2),
              reach:
                platform === "META_ADS"
                  ? Math.floor(impressions * (0.6 + rand() * 0.3))
                  : null,
              frequency:
                platform === "META_ADS" ? (1 + rand() * 2).toFixed(4) : null,
              platformExtras:
                platform === "GOOGLE_ADS"
                  ? {
                      searchImpressionShare: Number(
                        (0.4 + rand() * 0.6).toFixed(3),
                      ),
                    }
                  : {
                      videoViews: Math.floor(impressions * (rand() * 0.3)),
                      leads: Math.floor(conversions),
                    },
            });
          }
          await tx.campaignMetricDaily.createMany({ data: rows });
          metricsCreated += rows.length;
        }

        await tx.syncLog.create({
          data: {
            tenantId: tenant.id,
            adAccountId: account.id,
            platform,
            startedAt: new Date(Date.now() - 60_000),
            finishedAt: new Date(),
            status: "SUCCESS",
            recordsProcessed: METRIC_DAYS * 3,
          },
        });
      }
    }
    console.log(
      `  + ${adAccountsCreated} ad accounts · ${campaignsCreated} campanhas · ${metricsCreated} métricas`,
    );
  });
}

/**
 * Cria/atualiza o usuário SUPER_ADMIN no tenant técnico `system`. O tenant
 * foi inserido pela migration `20260520101000_add_super_admin_and_system_tenant`.
 * Credenciais via env (SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD) com fallback
 * previsível para dev — documentado no README.
 */
async function seedSuperAdmin(prisma: PrismaClient) {
  // SALVAGUARDA: em produção exigir credenciais explícitas via env. Sem
  // isso, o seed criaria o super admin com a senha de dev `dev-super-123`
  // — credencial conhecida em código, vazamento crítico.
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SUPER_ADMIN_PASSWORD
  ) {
    console.warn(
      "⚠ NODE_ENV=production sem SUPER_ADMIN_PASSWORD definido — super admin NÃO foi seedado.",
    );
    console.warn(
      "  Defina SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD/SUPER_ADMIN_NAME no .env e rode o seed de novo.",
    );
    return;
  }

  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? "superadmin@system.test"
  ).toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "dev-super-123";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  const tenant = await prisma.tenant.findFirst({
    where: { slug: "__system__" },
    select: { id: true },
  });
  if (!tenant) {
    console.warn(
      "⚠ tenant `__system__` não encontrado — a migration add_super_admin_and_system_tenant rodou?",
    );
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await withScope(prisma, tenant.id, async (tx) => {
    const existing = await tx.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: { name, passwordHash: hash, role: "SUPER_ADMIN" },
      });
      console.log(`✓ super admin ${email} atualizado`);
    } else {
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          passwordHash: hash,
          role: "SUPER_ADMIN",
        },
      });
      console.log(`✓ super admin ${email} criado (senha: ${password})`);
    }
  });
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL/DIRECT_URL não configurados.");

  // O seed usa DIRECT_URL (sem pooler) para evitar timeouts em transações
  // longas pelo PgBouncer.
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  await seedSuperAdmin(prisma);

  for (const t of TENANTS) {
    await seedTenant(prisma, t);
  }

  await prisma.$disconnect();
  console.log("\n✓ seed concluído.");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

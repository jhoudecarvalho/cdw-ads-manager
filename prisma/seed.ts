import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Platform,
  type Prisma,
} from "../src/generated/prisma/client";
import { DOCUMENT_VERSIONS } from "../src/server/auth/terms";

/**
 * Seed idempotente — pode rodar quantas vezes quiser.
 *
 * Cobertura:
 *   - 2 tenants (`anjos`, `kgepel`)
 *   - 1 ADMIN por tenant (senhas previsíveis só para dev)
 *   - 5 regiões oficiais brasileiras por tenant
 *   - N franquias por tenant distribuídas pelas regiões (default 12;
 *     ajuste com SEED_FRANCHISES_PER_TENANT)
 *   - 2 AdAccount por franquia (Google + Meta) mockados
 *   - 3 campanhas por AdAccount
 *   - 14 dias de métricas diárias por campanha
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

const TENANTS = [
  {
    slug: "anjos",
    name: "Anjos Programa",
    primaryColor: "#7C3AED",
    admin: {
      email: "admin@anjos.test",
      name: "Admin Anjos",
      password: "dev-anjos-123",
    },
  },
  {
    slug: "kgepel",
    name: "K-Gépel",
    primaryColor: "#0EA5E9",
    admin: {
      email: "admin@kgepel.test",
      name: "Admin K-Gépel",
      password: "dev-kgepel-123",
    },
  },
] as const;

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

async function seedTenant(prisma: PrismaClient, t: (typeof TENANTS)[number]) {
  // Tenant é "global" — sem RLS.
  const tenant = await prisma.tenant.upsert({
    where: { slug: t.slug },
    update: { name: t.name, primaryColor: t.primaryColor },
    create: { slug: t.slug, name: t.name, primaryColor: t.primaryColor },
    select: { id: true, slug: true },
  });
  console.log(`✓ tenant ${tenant.slug} (${tenant.id})`);

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
    const rand = rng(tenant.slug === "anjos" ? 1337 : 4242);
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

    // --- AdAccounts + Campaigns + Métricas ---
    const allFranchises = await tx.franchise.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    });

    // Recria do zero se houver poucas métricas — caso contrário pula (já
    // semeado). Critério barato: se já existe sync_logs DESTE tenant, completo.
    const syncCount = await tx.syncLog.count({
      where: { tenantId: tenant.id },
    });
    if (syncCount > 0) {
      console.log(`  ↻ ad accounts/campanhas já existem — pulando`);
      return;
    }

    const platforms: Platform[] = ["GOOGLE_ADS", "META_ADS"];
    let adAccountsCreated = 0;
    let campaignsCreated = 0;
    let metricsCreated = 0;

    for (const f of allFranchises) {
      for (const platform of platforms) {
        const account = await tx.adAccount.create({
          data: {
            tenantId: tenant.id,
            franchiseId: f.id,
            platform,
            externalAccountId: `mock-${platform.toLowerCase()}-${f.id.slice(-6)}`,
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
              franchiseId: f.id,
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

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL/DIRECT_URL não configurados.");

  // O seed usa DIRECT_URL (sem pooler) para evitar timeouts em transações
  // longas pelo PgBouncer.
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

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

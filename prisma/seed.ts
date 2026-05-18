import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed mínimo da Fase 1 — cria os dois tenants de exemplo (`anjos`,
 * `kgepel`). Idempotente: rodar várias vezes não duplica.
 *
 * A partir da Fase 3, este seed cresce para incluir regiões, ~300 franquias
 * fictícias, contas de anúncio mock e métricas diárias, conforme exige a
 * seção 9 da especificação.
 */
async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL/DIRECT_URL não configurados.");

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const tenants = [
    {
      slug: "anjos",
      name: "Anjos Programa",
      primaryColor: "#7C3AED",
    },
    {
      slug: "kgepel",
      name: "K-Gépel",
      primaryColor: "#0EA5E9",
    },
  ];

  for (const t of tenants) {
    const result = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, primaryColor: t.primaryColor },
      create: t,
      select: { slug: true, name: true, id: true },
    });
    console.log(`✓ tenant ${result.slug} (${result.id}) — ${result.name}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DOCUMENT_VERSIONS } from "../src/server/auth/terms";

/**
 * Seed idempotente — pode rodar quantas vezes quiser.
 *
 * Cobertura:
 * - 2 tenants (`anjos`, `kgepel`)
 * - 1 usuário ADMIN por tenant, com senha previsível só para dev
 * - Aceite de Termos e Política registrado (LGPD)
 *
 * A partir da Fase 3 este seed cresce para incluir regiões, ~300 franquias
 * fictícias, contas de anúncio mock e métricas diárias.
 */

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

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL/DIRECT_URL não configurados.");

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, primaryColor: t.primaryColor },
      create: {
        slug: t.slug,
        name: t.name,
        primaryColor: t.primaryColor,
      },
      select: { slug: true, name: true, id: true },
    });
    console.log(`✓ tenant ${tenant.slug} (${tenant.id}) — ${tenant.name}`);

    const passwordHash = await bcrypt.hash(t.admin.password, 12);

    // findFirst + create/update — `upsert` exige unique no `where`, mas a
    // unicidade é composta (tenantId, email), o que Prisma upsert não
    // suporta diretamente sem `@@unique` mapeado no `where`.
    const existing = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: t.admin.email },
      select: { id: true },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: t.admin.name,
          passwordHash,
          role: "ADMIN",
        },
      });
      console.log(`  ↻ user ${t.admin.email} (atualizado)`);
    } else {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: t.admin.email,
          name: t.admin.name,
          passwordHash,
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
      console.log(`  + user ${t.admin.email} (senha: ${t.admin.password})`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

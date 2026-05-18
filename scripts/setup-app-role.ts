/**
 * Garante o role `franchise_hub_app` no Postgres com:
 *   - LOGIN
 *   - NOBYPASSRLS (essencial para que as policies de RLS funcionem)
 *   - permissões CRUD nas tabelas públicas
 *
 * Por que separar do role default do Neon (`neondb_owner`):
 *   - O role default vem com `BYPASSRLS = true` e não pode ser alterado
 *     a partir de si mesmo (`ERROR: permission denied to alter role`).
 *   - Sem revogar BYPASSRLS, todas as policies de tenant são ignoradas.
 *
 * Resultado:
 *   - DIRECT_URL continua apontando para o owner (necessário para
 *     migrations: criar tabelas, alterar schema, etc.).
 *   - DATABASE_URL passa a usar `franchise_hub_app` — todas as queries do
 *     app respeitam RLS.
 *
 * IDEMPOTÊNCIA — comportamento por execução:
 *   - Role NÃO existe: gera senha aleatória, cria role, imprime a connection
 *     string nova para colar no .env.
 *   - Role JÁ existe: garante NOBYPASSRLS e re-aplica os GRANTs. NÃO mexe na
 *     senha — preservar a senha existente evita quebrar APP_DATABASE_URL no
 *     .env a cada re-deploy (o CI roda este script em todo deploy).
 *
 * Forçar rotação manual (raro — ex: senha vazou):
 *   APP_ROLE_ROTATE_PASSWORD=1 npx tsx scripts/setup-app-role.ts
 *   (e atualize APP_DATABASE_URL no .env com a saída.)
 *
 * Rode no primeiro bootstrap:
 *   npx tsx scripts/setup-app-role.ts
 */

import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "node:crypto";

const APP_ROLE = "franchise_hub_app";

async function main() {
  const adminUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DIRECT_URL / DATABASE_URL não configurados.");

  const forceRotate = process.env.APP_ROLE_ROTATE_PASSWORD === "1";

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const exists = await client.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname = $1",
    [APP_ROLE],
  );

  let generatedPassword: string | null = null;

  if (exists.rows.length === 0) {
    generatedPassword = randomBytes(24).toString("base64url");
    await client.query(
      `CREATE ROLE "${APP_ROLE}" WITH LOGIN NOBYPASSRLS PASSWORD '${generatedPassword.replace(/'/g, "''")}'`,
    );
    console.log(`+ role ${APP_ROLE} criado.`);
  } else if (forceRotate) {
    generatedPassword = randomBytes(24).toString("base64url");
    await client.query(
      `ALTER ROLE "${APP_ROLE}" WITH LOGIN NOBYPASSRLS PASSWORD '${generatedPassword.replace(/'/g, "''")}'`,
    );
    console.log(`↻ role ${APP_ROLE} — senha rotacionada (APP_ROLE_ROTATE_PASSWORD=1).`);
  } else {
    // Garante o flag sem mexer na senha — preserva APP_DATABASE_URL no .env.
    await client.query(`ALTER ROLE "${APP_ROLE}" WITH LOGIN NOBYPASSRLS`);
    console.log(`✓ role ${APP_ROLE} já existe (senha preservada).`);
  }

  // Permissões mínimas para o app: USAGE no schema, CRUD nas tabelas e
  // sequences (cuids são strings, mas migrations futuras podem criar
  // sequences — então autorizamos preventivamente).
  await client.query(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`,
  );
  await client.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_ROLE}"`,
  );

  // Mesmas permissões em tabelas/sequences criadas DEPOIS deste setup, sem
  // ter que reexecutar este script.
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE}"`,
  );

  await client.end();

  if (generatedPassword) {
    const url = new URL(adminUrl);
    url.username = APP_ROLE;
    url.password = generatedPassword;

    console.log("");
    console.log("✓ role configurado.");
    console.log("");
    console.log("Cole no .env:");
    console.log("");
    console.log(`APP_DATABASE_URL="${url.toString()}"`);
    console.log("");
    console.log(
      "Mantenha DIRECT_URL como está (apontando para o owner) — Prisma Migrate precisa dele.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

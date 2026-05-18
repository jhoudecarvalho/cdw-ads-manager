/**
 * Cria (uma única vez) o role `franchise_hub_app` no Postgres com:
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
 *   - DIRECT_URL continua apontando para `neondb_owner` (necessário para
 *     migrations: criar tabelas, alterar schema, etc.).
 *   - DATABASE_URL passa a usar `franchise_hub_app` — todas as queries do
 *     app respeitam RLS.
 *
 * Rode UMA vez por banco:
 *   npx tsx scripts/setup-app-role.ts
 */

import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "node:crypto";

const APP_ROLE = "franchise_hub_app";

async function main() {
  const adminUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DIRECT_URL / DATABASE_URL não configurados.");

  const password = randomBytes(24).toString("base64url");

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const exists = await client.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname = $1",
    [APP_ROLE],
  );

  if (exists.rows.length > 0) {
    await client.query(
      `ALTER ROLE "${APP_ROLE}" WITH LOGIN NOBYPASSRLS PASSWORD '${password.replace(/'/g, "''")}'`,
    );
    console.log(`↻ role ${APP_ROLE} atualizado (nova senha).`);
  } else {
    await client.query(
      `CREATE ROLE "${APP_ROLE}" WITH LOGIN NOBYPASSRLS PASSWORD '${password.replace(/'/g, "''")}'`,
    );
    console.log(`+ role ${APP_ROLE} criado.`);
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

  // Constrói a connection string nova trocando user e password.
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = password;
  const newUrl = url.toString();

  console.log("");
  console.log("✓ role configurado.");
  console.log("");
  console.log("Atualize seu .env trocando DATABASE_URL por:");
  console.log("");
  console.log(`DATABASE_URL="${newUrl}"`);
  console.log("");
  console.log(
    "Mantenha DIRECT_URL como está (apontando para o owner) — Prisma Migrate precisa dele.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

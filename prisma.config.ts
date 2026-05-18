import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma Migrate precisa de uma conexão direta (sem pooler). No Neon usamos
// DIRECT_URL; em Postgres local, DIRECT_URL pode ser igual a DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

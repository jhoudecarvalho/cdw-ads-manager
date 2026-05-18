import { z } from "zod";

/**
 * Validação das variáveis de ambiente. Roda no boot — se algo crítico estiver
 * faltando, o servidor falha rápido com mensagem clara, em vez de quebrar mais
 * tarde em runtime.
 *
 * Helpers: variáveis opcionais aceitam string vazia (placeholder no .env) e
 * tratam como ausentes. Assim o .env.example pode trazer chaves preenchidas
 * com "" sem quebrar o boot até elas serem realmente usadas.
 */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: optionalUrl,

  // Auth.js v5 aceita AUTH_SECRET ou NEXTAUTH_SECRET; aceitamos os dois e o
  // boot exige pelo menos um quando NODE_ENV !== "test".
  NEXTAUTH_SECRET: optionalString,
  NEXTAUTH_URL: optionalUrl,
  AUTH_SECRET: optionalString,
  AUTH_TRUST_HOST: optionalString,

  ENCRYPTION_KEY: optionalString,
  CRON_SECRET: optionalString,

  GOOGLE_ADS_CLIENT_ID: optionalString,
  GOOGLE_ADS_CLIENT_SECRET: optionalString,
  GOOGLE_ADS_DEVELOPER_TOKEN: optionalString,

  META_ADS_CLIENT_ID: optionalString,
  META_ADS_CLIENT_SECRET: optionalString,

  ADS_INTEGRATIONS_MODE: z.enum(["mock", "live"]).default("mock"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Variáveis de ambiente inválidas:",
    z.treeifyError(parsed.error),
  );
  throw new Error("Falha na validação do ambiente — veja o log acima.");
}

export const env = parsed.data;

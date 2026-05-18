import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — testes de fluxos críticos de ponta a ponta.
 *
 * Foco da Fase 7: provar visualmente o isolamento entre tenants e o fluxo
 * de auth. Cobertura ampla das telas vem por demanda quando algo quebrar
 * em produção.
 *
 * Estratégia:
 *   - `webServer` sobe `npm run dev` automaticamente (reusa se já tiver)
 *   - Único projeto: Chromium headless (chrome-headless-shell é mais leve)
 *   - Tests vivem em `tests/e2e/`
 *
 * Pré-requisito: `npm run db:seed` rodado pelo menos uma vez (precisamos
 * dos admins `admin@anjos.test` e `admin@kgepel.test`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // sessões compartilhariam cookies se paralelo
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

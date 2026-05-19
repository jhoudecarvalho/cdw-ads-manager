import { test, expect, type Page } from "@playwright/test";

/**
 * Fluxos por tenantType: confirma a UI condicional + autorização da área
 * Super Admin. Requer `npm run db:seed` (anjos=FRANCHISE, kgepel=COMPANY,
 * superadmin@system.test).
 */

const ANJOS = {
  slug: "anjos",
  email: "admin@anjos.test",
  password: "dev-anjos-123",
};

const KGEPEL = {
  slug: "kgepel",
  email: "admin@kgepel.test",
  password: "dev-kgepel-123",
};

async function login(page: Page, tenant: typeof ANJOS) {
  await page.goto(`/${tenant.slug}/login`);
  await page.getByLabel("E-mail").fill(tenant.email);
  await page.getByLabel("Senha").fill(tenant.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`**/${tenant.slug}`);
}

test.describe("Modo COMPANY (kgepel)", () => {
  test("sidebar mostra Empresas + Cadastrar Empresa e esconde Regiões", async ({
    page,
  }) => {
    await login(page, KGEPEL);
    // Sidebar tem o item Campanhas Ads aberto por default.
    await expect(page.getByRole("link", { name: /Empresas/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Cadastrar Empresa/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Regiões$/ }),
    ).toHaveCount(0);
    // Item "Franquias" não deve aparecer.
    await expect(
      page.getByRole("link", { name: /^Franquias$/ }),
    ).toHaveCount(0);
  });

  test("acessar /campanhas/franquias em tenant COMPANY → 404", async ({
    page,
  }) => {
    await login(page, KGEPEL);
    const res = await page.goto(`/${KGEPEL.slug}/campanhas/franquias`);
    expect(res?.status()).toBe(404);
  });

  test("cadastrar empresa cria e redireciona para a lista", async ({
    page,
  }) => {
    await login(page, KGEPEL);
    await page.goto(`/${KGEPEL.slug}/campanhas/empresas/cadastrar`);

    const name = `Empresa Teste ${Date.now()}`;
    await page.getByLabel("Nome da empresa").fill(name);
    await page.getByLabel("Setor").fill("Tecnologia");
    await page.getByRole("button", { name: /Cadastrar Empresa/ }).click();

    await page.waitForURL(`**/${KGEPEL.slug}/campanhas/empresas`);
    await expect(page.getByText(name)).toBeVisible();
  });
});

test.describe("Modo FRANCHISE (anjos) — comportamento atual preservado", () => {
  test("sidebar mostra Franquias + Regiões e esconde Empresas", async ({
    page,
  }) => {
    await login(page, ANJOS);
    await expect(page.getByRole("link", { name: /^Franquias$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Regiões$/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Empresas$/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Cadastrar Empresa/ }),
    ).toHaveCount(0);
  });

  test("acessar /campanhas/empresas em tenant FRANCHISE → 404", async ({
    page,
  }) => {
    await login(page, ANJOS);
    const res = await page.goto(`/${ANJOS.slug}/campanhas/empresas`);
    expect(res?.status()).toBe(404);
  });
});

test.describe("Área Super Admin", () => {
  test("não logado: /admin redireciona para /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("logado como ADMIN comum: /admin redireciona para /admin/login", async ({
    page,
  }) => {
    await login(page, ANJOS);
    await page.goto("/admin");
    // O guard do (authenticated)/layout.tsx faz redirect → login.
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

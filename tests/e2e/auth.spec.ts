import { test, expect, type Page } from "@playwright/test";

/**
 * Fluxos críticos de auth + isolamento de tenant.
 *
 * Use credenciais de seed (`npm run db:seed` cria os dois admins).
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

test.describe("Auth", () => {
  test("admin do anjos consegue logar e cair na Visão Geral", async ({
    page,
  }) => {
    await login(page, ANJOS);
    await expect(
      page.getByRole("heading", { name: "Visão Geral" }),
    ).toBeVisible();
    // O subtítulo da Visão Geral contém o slug do tenant.
    await expect(page.getByText(/anjos · últimos/)).toBeVisible();
  });

  test("login com senha errada continua na tela de login e mostra erro", async ({
    page,
  }) => {
    await page.goto(`/${ANJOS.slug}/login`);
    await page.getByLabel("E-mail").fill(ANJOS.email);
    await page.getByLabel("Senha").fill("senha-errada-1234");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/E-mail ou senha incorretos/i)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${ANJOS.slug}/login`));
  });

  test("rota autenticada sem sessão redireciona para /login", async ({
    page,
  }) => {
    const res = await page.goto(`/${ANJOS.slug}`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(`/${ANJOS.slug}/login`));
  });
});

test.describe("Isolamento entre tenants", () => {
  test("sessão do anjos NÃO acessa /kgepel — redireciona para /kgepel/login", async ({
    page,
  }) => {
    await login(page, ANJOS);
    await expect(
      page.getByRole("heading", { name: "Visão Geral" }),
    ).toBeVisible();

    await page.goto(`/${KGEPEL.slug}`);
    // O guard de sessão do (app)/layout.tsx redireciona para o login do
    // tenant correto quando a sessão pertence a outro tenant.
    await expect(page).toHaveURL(new RegExp(`/${KGEPEL.slug}/login`));
  });
});

import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/server/tenant/resolver";
import { loginAction, type FormState } from "@/server/auth/actions";
import { LoginForm } from "./_form";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== "ACTIVE") notFound();

  async function bound(prev: FormState, formData: FormData) {
    "use server";
    return loginAction(slug, prev, formData);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-8 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {tenant.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Entrar</h1>
      </header>

      <LoginForm action={bound} signupHref={`/${slug}/signup`} />
    </main>
  );
}

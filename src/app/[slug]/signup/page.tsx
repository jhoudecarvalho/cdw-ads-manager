import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/server/tenant/resolver";
import { signupAction, type FormState } from "@/server/auth/actions";
import { SignupForm } from "./_form";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SignupPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== "ACTIVE") notFound();

  async function bound(prev: FormState, formData: FormData) {
    "use server";
    return signupAction(slug, prev, formData);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-8 text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {tenant.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Criar conta</h1>
        <p className="mt-2 text-xs text-zinc-500">
          O primeiro usuário cadastrado vira administrador da franqueadora.
        </p>
      </header>

      <SignupForm action={bound} loginHref={`/${slug}/login`} />
    </main>
  );
}

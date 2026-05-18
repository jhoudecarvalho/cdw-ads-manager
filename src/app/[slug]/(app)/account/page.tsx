import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { withTenantScope } from "@/server/db/tenant-scope";
import { DeleteAccountFlow, ExportButton } from "./_actions";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function AccountPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const tenantId = session!.user.tenantId;

  const data = await withTenantScope(tenantId, async (tx) => {
    const [user, terms] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      tx.termsAcceptance.findMany({
        where: { userId },
        select: {
          documentKey: true,
          version: true,
          acceptedAt: true,
        },
        orderBy: { acceptedAt: "desc" },
      }),
    ]);
    return { user, terms };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <DashboardHeader title="Minha conta" subtitle={slug} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Row label="Nome" value={data.user?.name ?? "—"} />
            <Row label="E-mail" value={data.user?.email ?? "—"} />
            <Row label="Papel" value={data.user?.role ?? "—"} />
            <Row
              label="Conta criada em"
              value={data.user?.createdAt.toLocaleString("pt-BR") ?? "—"}
            />
            <Row
              label="Último login"
              value={
                data.user?.lastLoginAt
                  ? data.user.lastLoginAt.toLocaleString("pt-BR")
                  : "—"
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aceites de Termos e Política
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aceite registrado.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.terms.map((t, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                >
                  <span className="font-medium">
                    {t.documentKey === "terms_of_use"
                      ? "Termos de Uso"
                      : t.documentKey === "privacy_policy"
                        ? "Política de Privacidade"
                        : t.documentKey}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v. {t.version} · {t.acceptedAt.toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Direitos do titular (LGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Acesso aos dados (art. 15)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Baixe um arquivo JSON com tudo o que armazenamos sobre você:
              perfil, vínculos, aceites e histórico de ações.
            </p>
            <div className="mt-2">
              <ExportButton />
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-red-300">
              Exclusão / anonimização (art. 18)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sua conta será anonimizada — PII removida, vínculos preservados
              para integridade, trilha de auditoria mantida sem identificá-lo.
              Você não conseguirá mais logar.
            </p>
            <div className="mt-2">
              <DeleteAccountFlow tenantSlug={slug} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

import Link from "next/link";
import { listTenants } from "@/server/super-admin/queries";
import { brl, int } from "@/lib/format";
import { ImpersonateButton } from "./_impersonate-button";

export default async function SuperAdminDashboardPage() {
  const tenants = await listTenants({ rangeDays: 14 });

  const totals = tenants.reduce(
    (acc, t) => {
      acc.units += t.unitCount;
      acc.campaigns += t.campaignCount;
      acc.spend += t.spendLastNDays ?? 0;
      return acc;
    },
    { units: 0, campaigns: 0, spend: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          consolidação global · últimos 14 dias
        </p>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Tenants" value={int(tenants.length)} />
        <Kpi label="Unidades" value={int(totals.units)} />
        <Kpi label="Campanhas" value={int(totals.campaigns)} />
        <Kpi label="Investimento 14d" value={brl(totals.spend)} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tenants</h2>
          <Link
            href="/admin/tenants"
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            Gerenciar →
          </Link>
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-left font-mono text-[10px] uppercase tracking-[1px] text-text-muted">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Unidades</th>
                <th className="px-3 py-2 text-right">Campanhas</th>
                <th className="px-3 py-2 text-right">Invest. 14d</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-xs text-text-muted"
                  >
                    Nenhum tenant criado ainda.
                  </td>
                </tr>
              )}
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {t.tenantType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{t.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {int(t.unitCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {int(t.campaignCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {brl(t.spendLastNDays ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ImpersonateButton tenantId={t.id} disabled={t.status !== "ACTIVE"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

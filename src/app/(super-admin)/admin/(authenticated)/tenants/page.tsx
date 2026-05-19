import { listTenants } from "@/server/super-admin/queries";
import {
  createTenantAction,
  type SuperAdminFormState,
} from "../../_actions";
import { CreateTenantForm } from "./_create-form";
import { StatusToggle } from "./_status-toggle";

export default async function TenantsAdminPage() {
  const tenants = await listTenants();

  async function bound(prev: SuperAdminFormState, formData: FormData) {
    "use server";
    return createTenantAction(prev, formData);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <h1 className="text-2xl font-extrabold">Tenants</h1>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-left font-mono text-[10px] uppercase tracking-[1px] text-text-muted">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Criado em</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-xs">{t.tenantType}</td>
                  <td className="px-3 py-2 text-xs">{t.status}</td>
                  <td className="px-3 py-2 text-xs text-text-muted">
                    {t.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <StatusToggle
                      tenantId={t.id}
                      currentStatus={t.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Novo tenant</h2>
        <p className="text-xs text-text-muted">
          O tipo (Franquia / Empresa) é fixado na criação. Um usuário ADMIN
          inicial é criado automaticamente.
        </p>
        <CreateTenantForm action={bound} />
      </aside>
    </div>
  );
}

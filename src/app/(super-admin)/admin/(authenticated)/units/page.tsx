import { listAllUnits } from "@/server/super-admin/queries";

export default async function GlobalUnitsPage() {
  const units = await listAllUnits();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted">
          franquias e empresas de todos os tenants
        </p>
        <h1 className="text-2xl font-extrabold">Unidades globais</h1>
      </header>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-left font-mono text-[10px] uppercase tracking-[1px] text-text-muted">
            <tr>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Detalhe</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-xs text-text-muted"
                >
                  Nenhuma unidade cadastrada.
                </td>
              </tr>
            )}
            {units.map((u) => (
              <tr key={`${u.tenantId}-${u.id}`} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{u.tenantSlug}</span>{" "}
                  <span className="text-text-muted">· {u.tenantName}</span>
                </td>
                <td className="px-3 py-2 text-xs">{u.tenantType}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {u.externalCode ?? "—"}
                </td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 text-xs text-text-muted">{u.extra}</td>
                <td className="px-3 py-2 text-xs">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

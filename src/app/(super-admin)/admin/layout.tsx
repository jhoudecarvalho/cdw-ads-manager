/**
 * Layout neutro do route group `(super-admin)/admin`. Guarda real fica em
 * `(authenticated)/layout.tsx` — assim a rota `/admin/login` não cai no
 * próprio guard que ela precisa burlar para existir.
 */
export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-text" style={{ background: "var(--bg)" }}>
      {children}
    </div>
  );
}

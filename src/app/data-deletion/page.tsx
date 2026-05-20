type Props = {
  searchParams: Promise<{ code?: string }>;
};

export const metadata = {
  title: "Exclusão de dados · Franchise HUB",
};

/**
 * Página pública de status de exclusão de dados — é a `url` que o Data
 * Deletion Callback da Meta retorna. Também serve de instruções para quem
 * quer solicitar exclusão manualmente.
 */
export default async function DataDeletionPage({ searchParams }: Props) {
  const { code } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Exclusão de dados
      </h1>

      {code ? (
        <div
          className="mt-6 rounded-md border border-green-500/30 px-4 py-3 text-sm text-green-300"
          style={{ background: "rgba(52, 211, 153, 0.10)" }}
        >
          <p>
            Recebemos e processamos seu pedido de exclusão. As conexões de
            conta de anúncio associadas ao seu login do Meta foram removidas e
            os tokens de acesso correspondentes foram apagados.
          </p>
          <p className="mt-2 font-mono text-xs text-text-muted">
            Código de confirmação: {code}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-muted">
          Esta página confirma pedidos de exclusão de dados originados pela
          remoção do nosso aplicativo no Meta.
        </p>
      )}

      <section className="mt-10 space-y-4 text-sm text-text-muted">
        <h2 className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Como solicitar a exclusão
        </h2>
        <p>
          Você pode remover a conexão a qualquer momento de três formas:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Dentro da plataforma, em{" "}
            <span className="text-text">Campanhas → Contas Ads</span>, use
            “Desconectar” na conta desejada.
          </li>
          <li>
            No Facebook, em{" "}
            <span className="text-text">
              Configurações → Aplicativos e sites
            </span>
            , remova o nosso aplicativo. O Meta nos notifica automaticamente e
            os tokens são apagados.
          </li>
          <li>
            Por e-mail, solicitando a exclusão para o nosso contato de
            privacidade (ver a{" "}
            <a href="/privacidade" className="text-accent underline">
              Política de Privacidade
            </a>
            ).
          </li>
        </ul>
        <p>
          Dados de campanhas e métricas já coletados pertencem à conta de
          anúncio (informação de negócio) e podem ser mantidos conforme a
          Política de Privacidade; os dados pessoais de acesso (tokens) são
          removidos na desconexão.
        </p>
      </section>
    </main>
  );
}

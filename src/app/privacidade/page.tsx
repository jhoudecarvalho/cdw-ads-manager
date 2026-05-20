import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade · Franchise HUB",
};

/**
 * Política de Privacidade pública. Necessária para o App Review da Meta
 * (Privacy Policy URL) e para LGPD. Texto-base — revisar com jurídico antes
 * de produção. As seções sobre dados do Meta/Google são as que o review
 * verifica; mantê-las alinhadas com o que o app realmente coleta.
 */
export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-xs text-text-muted">
        Última atualização: 2026-05-20 · Documento-base, sujeito a revisão.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-text-muted">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">1. Quem somos</h2>
          <p>
            O Franchise HUB é uma plataforma de gestão de campanhas de anúncios
            (Google Ads e Meta Ads) para redes de franquias e empresas. Esta
            política descreve como tratamos dados pessoais e dados de contas de
            anúncio conectadas.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">
            2. Dados que coletamos
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-text">Conta e acesso:</span> nome, e-mail e
              credenciais de login na plataforma.
            </li>
            <li>
              <span className="text-text">Conexões de anúncio (Meta/Google):</span>{" "}
              ao conectar uma conta via OAuth, armazenamos o token de acesso
              (criptografado em repouso), o identificador da conta de anúncio e
              o identificador do usuário que autorizou a conexão.
            </li>
            <li>
              <span className="text-text">Métricas de campanha:</span> dados de
              desempenho (investimento, impressões, cliques, conversões) das
              contas conectadas, usados para exibir relatórios.
            </li>
            <li>
              <span className="text-text">Registros técnicos:</span> logs de
              acesso e auditoria (IP, user-agent) para segurança e conformidade.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">
            3. Como usamos os dados
          </h2>
          <p>
            Usamos os dados exclusivamente para operar a plataforma: autenticar
            usuários, sincronizar e exibir métricas das contas de anúncio
            conectadas e manter a segurança. Não vendemos dados pessoais nem os
            usamos para finalidades alheias ao serviço.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">
            4. Dados do Meta (Facebook)
          </h2>
          <p>
            Ao conectar uma conta Meta, solicitamos a permissão{" "}
            <code className="rounded bg-surface-alt px-1 py-0.5 text-xs">
              ads_read
            </code>{" "}
            para ler campanhas e métricas. O token de acesso é guardado
            criptografado e usado apenas para sincronizar dados daquela conta.
            Você pode revogar o acesso a qualquer momento removendo a conexão na
            plataforma ou removendo o aplicativo nas configurações do Facebook —
            nesse caso, recebemos a notificação de exclusão e apagamos os tokens
            correspondentes. Detalhes em{" "}
            <Link href="/data-deletion" className="text-accent underline">
              Exclusão de dados
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">5. Retenção</h2>
          <p>
            Tokens de acesso são apagados na desconexão da conta ou em pedido de
            exclusão. Dados de métricas podem ser retidos enquanto a conta
            estiver ativa na plataforma e por período adicional para fins legais
            e de auditoria, conforme a legislação aplicável.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">
            6. Seus direitos (LGPD)
          </h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos
            seus dados pessoais. A exclusão da conta pode ser feita dentro da
            plataforma (Conta → Excluir conta) e anonimiza seus dados de forma
            irreversível.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text">7. Contato</h2>
          <p>
            Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre
            em contato pelo canal informado no rodapé da plataforma ou pelo
            e-mail do encarregado de dados (DPO).
          </p>
        </section>
      </div>
    </main>
  );
}

import type { Platform } from "@/generated/prisma/client";

/**
 * Contrato comum para integrações de Ads. Adicionar uma terceira plataforma
 * (TikTok Ads, LinkedIn Ads, …) é implementar esta interface, plugar no
 * factory `getProvider()` e está pronto — nenhuma outra camada precisa
 * mudar.
 */

/** Campanha vinda do provedor — shape canonical, agnóstico de plataforma. */
export type ProviderCampaign = {
  externalId: string;
  name: string;
  type: string | null;
  status: "ACTIVE" | "PAUSED" | "REMOVED" | "ENDED";
  startDate: Date | null;
  endDate: Date | null;
};

/** Métrica diária por campanha. Campos específicos vão em `extras`. */
export type ProviderMetric = {
  externalCampaignId: string;
  date: Date;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  reach?: number | null;
  frequency?: number | null;
  extras?: Record<string, unknown>;
};

/** Credenciais que o provider precisa para fazer requests autenticados. */
export type ProviderCredentials = {
  externalAccountId: string;
  /** Token de acesso já decifrado (helpers de crypto cuidam disso na borda). */
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

/** Resultado de um refresh — novos tokens criptografáveis. */
export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type FetchRange = {
  /** Data inclusiva. */
  since: Date;
  /** Data inclusiva. Default: hoje (UTC). */
  until?: Date;
};

export interface AdsProvider {
  readonly platform: Platform;

  /**
   * Lista as campanhas existentes na conta.
   * Não traz métricas — só a "lista mestre" de campanhas.
   */
  listCampaigns(creds: ProviderCredentials): Promise<ProviderCampaign[]>;

  /**
   * Métricas diárias por campanha no intervalo.
   * Idempotente: mesma chamada com mesmos parâmetros = mesma resposta.
   */
  getDailyMetrics(
    creds: ProviderCredentials,
    range: FetchRange,
  ): Promise<ProviderMetric[]>;

  /**
   * Troca um refreshToken por novos tokens. Retorna sempre o refreshToken
   * (alguns provedores retornam o mesmo, outros giram).
   */
  refreshToken(refreshToken: string): Promise<RefreshedTokens>;
}

/** Erro lançado quando o provedor exige credenciais não configuradas. */
export class ProviderNotConfiguredError extends Error {
  constructor(platform: Platform, missing: string[]) {
    super(
      `Provider ${platform} não configurado — faltam env vars: ${missing.join(", ")}.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}

/** Erro lançado para falhas de API (rate limit, auth, etc.). */
export class ProviderApiError extends Error {
  constructor(
    public readonly platform: Platform,
    message: string,
    public readonly retryable: boolean = false,
    public readonly status?: number,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "ProviderApiError";
  }
}

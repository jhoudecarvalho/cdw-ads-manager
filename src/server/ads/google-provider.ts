import { env } from "@/env";
import type { Platform } from "@/generated/prisma/client";
import {
  ProviderNotConfiguredError,
  type AdsProvider,
  type FetchRange,
  type ProviderCampaign,
  type ProviderCredentials,
  type ProviderMetric,
  type RefreshedTokens,
} from "./provider";

/**
 * Adapter para a Google Ads API.
 *
 * STATUS: esqueleto. As chamadas reais ficam comentadas até as credenciais
 * estarem disponíveis. Para ativar:
 *
 *   1. Configure no .env: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e
 *      GOOGLE_ADS_DEVELOPER_TOKEN (o developer_token vem da aprovação do
 *      app no Google Ads — pode levar dias).
 *   2. Instale o SDK: `npm install google-ads-api` (ou use REST direto).
 *   3. Implemente os métodos abaixo seguindo a documentação:
 *      https://developers.google.com/google-ads/api/docs/start
 *   4. Os shapes de retorno (ProviderCampaign, ProviderMetric) já estão
 *      canonicalizados — basta mapear da resposta da API para eles.
 *   5. Lance ProviderApiError com `retryable=true` em 429/5xx para o sync
 *      service tentar backoff exponencial.
 */
export class GoogleAdsProvider implements AdsProvider {
  readonly platform: Platform = "GOOGLE_ADS";

  constructor() {
    const missing = this.missingEnv();
    if (missing.length) {
      throw new ProviderNotConfiguredError(this.platform, missing);
    }
  }

  private missingEnv(): string[] {
    const need = {
      GOOGLE_ADS_CLIENT_ID: env.GOOGLE_ADS_CLIENT_ID,
      GOOGLE_ADS_CLIENT_SECRET: env.GOOGLE_ADS_CLIENT_SECRET,
      GOOGLE_ADS_DEVELOPER_TOKEN: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    };
    return Object.entries(need)
      .filter(([, v]) => !v)
      .map(([k]) => k);
  }

  async listCampaigns(
    _creds: ProviderCredentials,
  ): Promise<ProviderCampaign[]> {
    throw new Error(
      "GoogleAdsProvider.listCampaigns() ainda não implementado — adicione a chamada GAQL real (SELECT campaign.id, campaign.name, campaign.status, ...).",
    );
  }

  async getDailyMetrics(
    _creds: ProviderCredentials,
    _range: FetchRange,
  ): Promise<ProviderMetric[]> {
    throw new Error(
      "GoogleAdsProvider.getDailyMetrics() ainda não implementado — use GAQL com segments.date e métricas (metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, ...).",
    );
  }

  async refreshToken(_refreshToken: string): Promise<RefreshedTokens> {
    throw new Error(
      "GoogleAdsProvider.refreshToken() ainda não implementado — chame https://oauth2.googleapis.com/token com grant_type=refresh_token.",
    );
  }
}

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
 * Adapter para a Meta Marketing API.
 *
 * STATUS: esqueleto. Para ativar:
 *
 *   1. Configure no .env: META_ADS_CLIENT_ID, META_ADS_CLIENT_SECRET.
 *   2. Sem SDK obrigatório — Marketing API funciona bem via fetch REST:
 *      https://graph.facebook.com/v23.0/{ad-account-id}/insights?...
 *   3. Implemente as 3 funções abaixo. As métricas relevantes (impressions,
 *      reach, frequency, spend, actions, action_values, video_views,
 *      link_clicks) vêm no endpoint /insights com `time_increment=1`.
 *   4. Tokens de longa duração: trocar short-lived → long-lived ao conectar
 *      a primeira vez (oauth/access_token?grant_type=fb_exchange_token).
 *   5. Lance ProviderApiError com `retryable=true` em 429/5xx.
 */
export class MetaAdsProvider implements AdsProvider {
  readonly platform: Platform = "META_ADS";

  constructor() {
    const missing = this.missingEnv();
    if (missing.length) {
      throw new ProviderNotConfiguredError(this.platform, missing);
    }
  }

  private missingEnv(): string[] {
    const need = {
      META_ADS_CLIENT_ID: env.META_ADS_CLIENT_ID,
      META_ADS_CLIENT_SECRET: env.META_ADS_CLIENT_SECRET,
    };
    return Object.entries(need)
      .filter(([, v]) => !v)
      .map(([k]) => k);
  }

  async listCampaigns(
    _creds: ProviderCredentials,
  ): Promise<ProviderCampaign[]> {
    throw new Error(
      "MetaAdsProvider.listCampaigns() ainda não implementado — GET /act_{id}/campaigns?fields=id,name,objective,status",
    );
  }

  async getDailyMetrics(
    _creds: ProviderCredentials,
    _range: FetchRange,
  ): Promise<ProviderMetric[]> {
    throw new Error(
      "MetaAdsProvider.getDailyMetrics() ainda não implementado — GET /act_{id}/insights?level=campaign&time_increment=1&fields=campaign_id,impressions,reach,frequency,clicks,spend,actions,action_values,video_views,...",
    );
  }

  async refreshToken(_refreshToken: string): Promise<RefreshedTokens> {
    throw new Error(
      "MetaAdsProvider.refreshToken() ainda não implementado — tokens long-lived duram ~60 dias e são renovados com fb_exchange_token.",
    );
  }
}

import type { Platform } from "@/generated/prisma/client";
import type {
  AdsProvider,
  FetchRange,
  ProviderCampaign,
  ProviderCredentials,
  ProviderMetric,
  RefreshedTokens,
} from "./provider";

/**
 * Provedor de mentirinha para desenvolvimento e CI sem credenciais reais.
 *
 * Determinístico: a saída depende apenas de `externalAccountId`, `date` e
 * `platform` — chamar a mesma função de novo retorna exatamente os mesmos
 * números. Isso garante que rodar o sync 2x não cria flapping nos dashboards
 * e que os testes de idempotência ficam previsíveis.
 *
 * Cobre 3 campanhas por conta. Métricas por dia variam dentro de faixas
 * realistas para o tipo de conta.
 */

const CAMPAIGN_TYPES_GOOGLE = ["SEARCH", "PERFORMANCE_MAX", "DISPLAY"] as const;
const CAMPAIGN_TYPES_META = [
  "LEAD_GENERATION",
  "TRAFFIC",
  "ENGAGEMENT",
] as const;

/** PRNG mulberry32 — idêntico ao seed para que os números "casem". */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(parts: (string | number)[]): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export class MockAdsProvider implements AdsProvider {
  constructor(public readonly platform: Platform) {}

  async listCampaigns(creds: ProviderCredentials): Promise<ProviderCampaign[]> {
    const types =
      this.platform === "GOOGLE_ADS"
        ? CAMPAIGN_TYPES_GOOGLE
        : CAMPAIGN_TYPES_META;
    return types.map((type, idx) => ({
      externalId: this.campaignExternalId(creds.externalAccountId, idx),
      name: `${type} #${idx + 1}`,
      type,
      status: "ACTIVE" as const,
      startDate: null,
      endDate: null,
    }));
  }

  async getDailyMetrics(
    creds: ProviderCredentials,
    range: FetchRange,
  ): Promise<ProviderMetric[]> {
    const types =
      this.platform === "GOOGLE_ADS"
        ? CAMPAIGN_TYPES_GOOGLE
        : CAMPAIGN_TYPES_META;
    const since = startOfUtcDay(range.since);
    const until = startOfUtcDay(range.until ?? new Date());

    const out: ProviderMetric[] = [];
    for (let idx = 0; idx < types.length; idx++) {
      const externalCampaignId = this.campaignExternalId(
        creds.externalAccountId,
        idx,
      );
      for (
        let d = new Date(since);
        d.getTime() <= until.getTime();
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const date = new Date(d);
        const seed = seedFor([
          this.platform,
          creds.externalAccountId,
          idx,
          date.toISOString().slice(0, 10),
        ]);
        const rand = rng(seed);
        const spend = 50 + rand() * 950;
        const impressions = Math.floor(500 + rand() * 9500);
        const clicks = Math.floor(impressions * (0.005 + rand() * 0.04));
        const conversions = clicks * (0.01 + rand() * 0.08);
        const conversionValue = conversions * (40 + rand() * 200);
        out.push({
          externalCampaignId,
          date,
          spend: round2(spend),
          impressions,
          clicks,
          conversions: round4(conversions),
          conversionValue: round2(conversionValue),
          reach:
            this.platform === "META_ADS"
              ? Math.floor(impressions * (0.6 + rand() * 0.3))
              : null,
          frequency:
            this.platform === "META_ADS" ? round4(1 + rand() * 2) : null,
          extras:
            this.platform === "GOOGLE_ADS"
              ? {
                  searchImpressionShare: Number(
                    (0.4 + rand() * 0.6).toFixed(3),
                  ),
                }
              : {
                  videoViews: Math.floor(impressions * (rand() * 0.3)),
                  leads: Math.floor(conversions),
                },
        });
      }
    }
    return out;
  }

  async refreshToken(): Promise<RefreshedTokens> {
    // Mock — só renova a janela de validade.
    return {
      accessToken: `mock-access-${Date.now()}`,
      refreshToken: `mock-refresh-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    };
  }

  private campaignExternalId(externalAccountId: string, idx: number): string {
    return `ext-${externalAccountId.slice(-6)}-${idx}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

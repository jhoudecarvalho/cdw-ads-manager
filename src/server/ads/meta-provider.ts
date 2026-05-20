import { env } from "@/env";
import type { Platform } from "@/generated/prisma/client";
import { META_API_VERSION } from "./meta-oauth";
import {
  ProviderApiError,
  ProviderNotConfiguredError,
  type AdsProvider,
  type FetchRange,
  type ProviderCampaign,
  type ProviderCredentials,
  type ProviderMetric,
  type RefreshedTokens,
} from "./provider";

/**
 * Adapter da Meta Marketing API (Graph API via fetch REST).
 *
 * O OAuth (conexão da conta + token long-lived cifrado) vive em
 * `meta-oauth.ts` + route handlers. Aqui ficam as 3 operações que o sync usa:
 * listar campanhas, puxar métricas diárias e renovar token.
 *
 * `creds.externalAccountId` chega como `act_<id>` (formato da Graph API).
 * `creds.accessToken` chega **já decifrado** (o sync decifra na borda).
 */
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

type GraphError = { error?: { message?: string; code?: number } };

async function graph<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params).toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new ProviderApiError(
      "META_ADS",
      e instanceof Error ? e.message : "Falha de rede",
      true,
    );
  }
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new ProviderApiError(
      "META_ADS",
      json.error?.message ?? `Graph API retornou ${res.status}`,
      retryable,
      res.status,
    );
  }
  return json;
}

/** Percorre a paginação cursor-based da Graph API. */
async function graphPaged<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  // Teto de segurança — evita loop infinito se a API repetir cursor.
  for (let page = 0; page < 50; page++) {
    const p = { ...params, limit: "200", ...(after ? { after } : {}) };
    const data = await graph<{
      data: T[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(path, p);
    out.push(...data.data);
    const next = data.paging?.next ? data.paging.cursors?.after : undefined;
    if (!next) break;
    after = next;
  }
  return out;
}

const STATUS_MAP: Record<string, ProviderCampaign["status"]> = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  DELETED: "REMOVED",
  ARCHIVED: "ENDED",
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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

  private token(creds: ProviderCredentials): string {
    if (!creds.accessToken) {
      throw new ProviderApiError(
        this.platform,
        "Conta sem accessToken — reconecte via OAuth.",
        false,
      );
    }
    return creds.accessToken;
  }

  async listCampaigns(
    creds: ProviderCredentials,
  ): Promise<ProviderCampaign[]> {
    const rows = await graphPaged<{
      id: string;
      name: string;
      objective?: string;
      status?: string;
      start_time?: string;
      stop_time?: string;
    }>(`/${creds.externalAccountId}/campaigns`, {
      fields: "id,name,objective,status,start_time,stop_time",
      access_token: this.token(creds),
    });

    return rows.map((c) => ({
      externalId: c.id,
      name: c.name,
      type: c.objective ?? null,
      status: STATUS_MAP[c.status ?? ""] ?? "ACTIVE",
      startDate: c.start_time ? new Date(c.start_time) : null,
      endDate: c.stop_time ? new Date(c.stop_time) : null,
    }));
  }

  async getDailyMetrics(
    creds: ProviderCredentials,
    range: FetchRange,
  ): Promise<ProviderMetric[]> {
    const until = range.until ?? new Date();
    const rows = await graphPaged<{
      campaign_id: string;
      date_start: string;
      impressions?: string;
      clicks?: string;
      spend?: string;
      reach?: string;
      frequency?: string;
      actions?: Array<{ action_type: string; value: string }>;
      action_values?: Array<{ action_type: string; value: string }>;
    }>(`/${creds.externalAccountId}/insights`, {
      level: "campaign",
      time_increment: "1",
      fields:
        "campaign_id,impressions,clicks,spend,reach,frequency,actions,action_values",
      time_range: JSON.stringify({ since: ymd(range.since), until: ymd(until) }),
      access_token: this.token(creds),
    });

    const num = (v?: string) => (v ? Number(v) : 0);
    const sumAction = (
      arr: Array<{ action_type: string; value: string }> | undefined,
      types: string[],
    ): number => {
      if (!arr) return 0;
      return arr
        .filter((a) => types.includes(a.action_type))
        .reduce((s, a) => s + Number(a.value || 0), 0);
    };

    return rows.map((r) => {
      // "conversões": soma de purchases/leads/completar registro — heurística
      // comum; ajustável conforme o objetivo de cada cliente.
      const conversions = sumAction(r.actions, [
        "purchase",
        "lead",
        "complete_registration",
        "offsite_conversion.fb_pixel_purchase",
      ]);
      const conversionValue = sumAction(r.action_values, [
        "purchase",
        "offsite_conversion.fb_pixel_purchase",
      ]);
      return {
        externalCampaignId: r.campaign_id,
        date: new Date(`${r.date_start}T00:00:00.000Z`),
        spend: num(r.spend),
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        conversions,
        conversionValue,
        reach: r.reach ? num(r.reach) : null,
        frequency: r.frequency ? num(r.frequency) : null,
        extras: {
          actions: r.actions ?? [],
        },
      };
    });
  }

  async refreshToken(refreshToken: string): Promise<RefreshedTokens> {
    // Meta não tem refresh_token clássico: troca-se o long-lived atual por um
    // novo long-lived com fb_exchange_token.
    const data = await graph<{ access_token: string; expires_in?: number }>(
      "/oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: env.META_ADS_CLIENT_ID ?? "",
        client_secret: env.META_ADS_CLIENT_SECRET ?? "",
        fb_exchange_token: refreshToken,
      },
    );
    const expiresIn = data.expires_in ?? 55 * 24 * 3600;
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
}

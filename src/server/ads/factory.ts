import { env } from "@/env";
import type { Platform } from "@/generated/prisma/client";
import type { AdsProvider } from "./provider";
import { MockAdsProvider } from "./mock-provider";
import { GoogleAdsProvider } from "./google-provider";
import { MetaAdsProvider } from "./meta-provider";

/**
 * Cache módulo-local — providers são stateless, vale instanciar uma vez por
 * processo. O cache também garante que erros de configuração sejam jogados
 * cedo (no boot do sync, não em uma rota qualquer).
 */
const cache = new Map<string, AdsProvider>();

/**
 * Devolve o provider certo para a plataforma. Em `mock` (padrão dev), sempre
 * usa MockAdsProvider; em `live`, instancia Google/Meta — que vão dar erro
 * claro se as credenciais não estão configuradas.
 */
export function getProvider(platform: Platform): AdsProvider {
  const mode = env.ADS_INTEGRATIONS_MODE;
  const key = `${mode}:${platform}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let provider: AdsProvider;

  if (mode === "mock") {
    provider = new MockAdsProvider(platform);
  } else {
    switch (platform) {
      case "GOOGLE_ADS":
        provider = new GoogleAdsProvider();
        break;
      case "META_ADS":
        provider = new MetaAdsProvider();
        break;
    }
  }

  cache.set(key, provider);
  return provider;
}

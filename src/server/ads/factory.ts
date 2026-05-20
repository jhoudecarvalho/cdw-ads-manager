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
 * Devolve o provider certo para a plataforma.
 *
 * Decisão por conta (não global): só usa o provider real quando
 *   - `ADS_INTEGRATIONS_MODE === "live"` **e**
 *   - a conta tem credenciais (`hasCredentials` — i.e. token via OAuth).
 *
 * Caso contrário, usa o MockAdsProvider. Isso faz contas conectadas de
 * verdade (com token) puxarem dados reais, enquanto as contas mock do seed
 * (sem token) continuam funcionando com dados de demonstração — sem um flag
 * global que quebraria umas ou outras. Em `mock` (default dev/CI/test) tudo
 * é mock, garantindo testes determinísticos.
 */
export function getProvider(
  platform: Platform,
  hasCredentials = false,
): AdsProvider {
  const useReal = env.ADS_INTEGRATIONS_MODE === "live" && hasCredentials;
  const key = `${useReal ? "live" : "mock"}:${platform}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let provider: AdsProvider;

  if (!useReal) {
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

import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/server/crypto/tokens";
import type { MetaAdAccountOption } from "./meta-oauth";

/**
 * Estado intermediário do OAuth Meta entre o callback e a tela de seleção
 * de conta. Guarda o token long-lived (sensível!) e as contas disponíveis
 * num cookie HttpOnly **cifrado** (AES-256-GCM via crypto/tokens), TTL curto.
 *
 * Por que cookie e não banco: o vínculo ainda não foi decidido (o usuário
 * vai escolher a conta na próxima tela). Persistir no banco criaria uma
 * AdAccount órfã. O cookie morre em 10 min ou quando a seleção é confirmada.
 */

const COOKIE = "fh_meta_pending";
const TTL_SECONDS = 600;

export type MetaPending = {
  slug: string;
  unitId: string;
  token: string;
  expiresAt: string; // ISO
  accounts: MetaAdAccountOption[];
};

export async function setMetaPending(p: MetaPending): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, encrypt(JSON.stringify(p)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readMetaPending(): Promise<MetaPending | null> {
  const store = await cookies();
  const c = store.get(COOKIE);
  if (!c?.value) return null;
  try {
    const parsed = JSON.parse(decrypt(c.value)) as MetaPending;
    if (
      typeof parsed.slug !== "string" ||
      typeof parsed.unitId !== "string" ||
      typeof parsed.token !== "string" ||
      !Array.isArray(parsed.accounts)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearMetaPending(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

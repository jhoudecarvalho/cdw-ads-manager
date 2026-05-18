import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";
import { env } from "@/env";

/**
 * Criptografia simétrica para tokens OAuth em repouso (Google/Meta Ads).
 *
 * Algoritmo: AES-256-GCM
 *   - 256 bits de chave (32 bytes; lemos de `ENCRYPTION_KEY` em base64)
 *   - IV de 12 bytes aleatório por chamada (GCM recommends 96 bits)
 *   - Auth tag de 16 bytes (anti-tampering)
 *
 * Formato do ciphertext armazenado:
 *   "v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>"
 *
 * O prefixo de versão permite girar algoritmo/chave no futuro sem perder
 * leitura dos dados antigos. Hoje só existe a versão "v1".
 *
 * IMPORTANTE:
 *   - Nunca logue valores criptografados nem chaves.
 *   - Para rotação de chave, leia com a antiga, escreva com a nova.
 *     (Helper de rotação fica para uma fase futura — por ora a chave é fixa.)
 */

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = "v1" as const;

function getKey(): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Gere com `openssl rand -base64 32` e salve no .env.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY com tamanho inválido (${key.length} bytes; esperado 32). Gere uma nova com \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM;
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(
      "Token criptografado com formato inválido ou versão desconhecida.",
    );
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const authTag = Buffer.from(tagB64!, "base64");
  const encrypted = Buffer.from(dataB64!, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("IV ou auth tag com tamanho inválido.");
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv) as DecipherGCM;
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Decifra opcional — útil quando o campo pode estar `null` (token ainda não
 * conectado, ou conexão revogada).
 */
export function decryptOptional(
  ciphertext: string | null | undefined,
): string | null {
  if (!ciphertext) return null;
  return decrypt(ciphertext);
}

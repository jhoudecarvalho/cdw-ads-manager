/**
 * Versões correntes dos documentos legais. Atualize ao publicar nova revisão
 * — o `TermsAcceptance` registra a versão aceita pelo usuário no momento
 * (LGPD: histórico de consentimento auditável).
 *
 * Formato: data de publicação ISO (YYYY-MM-DD). Curto, ordenável e óbvio
 * para auditoria.
 */
export const DOCUMENT_VERSIONS = {
  terms_of_use: "2026-05-18",
  privacy_policy: "2026-05-18",
} as const;

export type DocumentKey = keyof typeof DOCUMENT_VERSIONS;

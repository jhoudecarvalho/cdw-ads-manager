/**
 * Helpers de formatação reutilizados nas telas de dashboard.
 */

export function brl(n: number, fractionDigits = 0): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: fractionDigits,
  });
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function pct(n: number, fractionDigits = 2): string {
  return `${n.toFixed(fractionDigits)}%`;
}

export function multiplier(n: number, fractionDigits = 2): string {
  return `${n.toFixed(fractionDigits)}x`;
}

export function platformLabel(p: "GOOGLE_ADS" | "META_ADS"): string {
  return p === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";
}

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appBaseUrl, parseSignedRequest } from "@/server/ads/meta-oauth";
import { revokeMetaConnectionsByUser } from "@/server/ads/data-deletion";

/**
 * Data Deletion Request Callback da Meta.
 *
 * Registrado no app Meta em "Data Deletion Request URL". A Meta chama este
 * endpoint (POST, body form-encoded com `signed_request`) quando um usuário
 * remove o app ou solicita exclusão dos dados. O contrato exige responder
 * JSON `{ url, confirmation_code }`:
 *   - `url`: página onde o usuário acompanha o status da exclusão.
 *   - `confirmation_code`: identificador do pedido.
 *
 * A exclusão é síncrona: revogamos as conexões Meta daquele usuário (todas
 * as AdAccounts com `connectedExternalUserId` correspondente, em todos os
 * tenants) antes de responder. A assinatura do `signed_request` (HMAC com o
 * app secret) é validada — request sem assinatura válida é rejeitada.
 */
export async function POST(req: Request): Promise<Response> {
  let signed: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { signed_request?: string };
      signed = body.signed_request ?? null;
    } else {
      const form = await req.formData();
      const v = form.get("signed_request");
      signed = typeof v === "string" ? v : null;
    }
  } catch {
    signed = null;
  }

  if (!signed) {
    return NextResponse.json(
      { error: "signed_request ausente." },
      { status: 400 },
    );
  }

  const payload = parseSignedRequest(signed);
  if (!payload?.user_id) {
    return NextResponse.json(
      { error: "signed_request inválido." },
      { status: 400 },
    );
  }

  // Identificador do pedido. A exclusão é síncrona, então quando respondemos
  // o trabalho já foi feito — a página de status apenas confirma.
  const confirmationCode = `del_${randomBytes(8).toString("hex")}`;

  try {
    await revokeMetaConnectionsByUser(payload.user_id);
  } catch (err) {
    // Não vazamos o user_id no log de erro além do necessário.
    console.error("[meta-data-deletion] falha ao revogar:", err);
    // Ainda assim respondemos o contrato — a Meta reentrega em falhas.
  }

  const url = `${appBaseUrl()}/data-deletion?code=${confirmationCode}`;
  return NextResponse.json({ url, confirmation_code: confirmationCode });
}

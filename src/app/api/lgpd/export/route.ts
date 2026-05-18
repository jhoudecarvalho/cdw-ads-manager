import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordAudit } from "@/server/audit/record";
import { exportUserData } from "@/server/lgpd/data-export";

/**
 * LGPD Art. 15 — exportação dos dados do titular logado.
 *
 * Só o próprio usuário pode exportar — sem parâmetro de userId, sem ADMIN
 * exportando dados de outro (admins têm acesso aos dados via dashboards,
 * mas para "exportação LGPD" cada titular precisa pedir o seu).
 *
 * Resposta: JSON com download attachment.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await exportUserData(session.user.tenantId, session.user.id);

  await recordAudit({
    tenantId: session.user.tenantId,
    eventType: "DATA_EXPORTED",
    actorUserId: session.user.id,
    resourceType: "user",
    resourceId: session.user.id,
  });

  const filename = `dados-${session.user.email?.replace(/[^a-z0-9]/gi, "_") ?? session.user.id}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

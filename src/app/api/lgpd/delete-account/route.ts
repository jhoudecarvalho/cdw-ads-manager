import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import { anonymizeUser } from "@/server/lgpd/anonymize";

const Body = z.object({
  /** Confirmação obrigatória — usuário precisa digitar "EXCLUIR" no form. */
  confirm: z.literal("EXCLUIR"),
  reason: z.string().max(500).optional(),
});

/**
 * LGPD Art. 18 — anonimiza a conta do titular logado.
 *
 * Confirmação dupla: além de POST explícito, exige `confirm: "EXCLUIR"` no
 * body. Faz signOut depois.
 *
 * **Não é reversível.** Após anonimizar, o titular não consegue mais logar
 * e o app não tem mais como identificá-lo.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'Confirmação inválida. Envie { confirm: "EXCLUIR" }.' },
      { status: 400 },
    );
  }

  const result = await anonymizeUser(
    session.user.tenantId,
    session.user.id,
    parsed.reason ?? "Solicitação do titular via /api/lgpd/delete-account",
  );

  // Termina a sessão — o usuário deixa de existir efetivamente.
  await signOut({ redirect: false });

  return NextResponse.json({
    ok: true,
    message: "Sua conta foi anonimizada. Você foi desconectado.",
    result,
  });
}

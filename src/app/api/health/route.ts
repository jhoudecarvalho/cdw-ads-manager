import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

// Healthcheck público (sem auth) — usado pelo HEALTHCHECK do Docker e pelo
// reverse proxy. Faz um SELECT 1 pra garantir que o app consegue falar com o
// Postgres; sem isso o container poderia ficar "up" mas servindo 500.
//
// `force-dynamic` evita que o Next prerendere a rota e devolva uma resposta
// cacheada — health precisa refletir o estado *agora*.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}

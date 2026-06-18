import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TABLE_SYSTEM_PRISMA_MODELS } from "@/lib/table-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vérifie que les tables Prisma du système table existent et répondent.
 * Utiliser après déploiement ou en monitoring.
 */
export async function GET() {
  try {
    await Promise.all([
      prisma.tableOrderMaster.findFirst({ select: { tableId: true }, take: 1 }),
      prisma.tableDraftCart.findFirst({ select: { tableId: true }, take: 1 }),
    ]);

    return NextResponse.json({
      ok: true,
      models: TABLE_SYSTEM_PRISMA_MODELS,
      message: "Système table opérationnel",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health/table-system]", message);
    return NextResponse.json(
      {
        ok: false,
        models: TABLE_SYSTEM_PRISMA_MODELS,
        message: "Migration Prisma manquante — exécutez `npm run migrate:deploy`",
        detail: message,
      },
      { status: 503 }
    );
  }
}

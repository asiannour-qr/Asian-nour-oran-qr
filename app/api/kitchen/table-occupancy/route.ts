import { NextResponse } from "next/server";
import { listOccupiedTables } from "@/lib/table-occupancy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const tables = await listOccupiedTables();
    return NextResponse.json({
      ok: true,
      tables: tables.map((t) => ({
        tableId: t.tableId,
        occupiedAt: t.occupiedAt.toISOString(),
        lastOrderId: t.lastOrderId,
      })),
    });
  } catch (error: unknown) {
    console.error("[kitchen/table-occupancy]", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

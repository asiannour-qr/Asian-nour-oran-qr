import { NextResponse } from "next/server";
import { clearTableMaster } from "@/lib/table-master";
import { clearTableDraftCart } from "@/lib/table-draft-cart";
import { releaseTable } from "@/lib/table-occupancy";
import { closeOpenDineInOrdersForTable } from "@/lib/table-release";
import { assertStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { tableId: string } }
) {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  const tableId = String(params.tableId).trim();
  if (!tableId || tableId === "EMPORTER") {
    return NextResponse.json({ ok: false, message: "Table invalide" }, { status: 400 });
  }

  try {
    const closedOrders = await closeOpenDineInOrdersForTable(tableId);
    const released = await releaseTable(tableId);
    await clearTableMaster(tableId);
    await clearTableDraftCart(tableId);
    return NextResponse.json({
      ok: true,
      released,
      closedOrders,
      message: released ? "Table libérée" : "Table réinitialisée",
    });
  } catch (error: unknown) {
    console.error("[kitchen/tables/release]", error);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

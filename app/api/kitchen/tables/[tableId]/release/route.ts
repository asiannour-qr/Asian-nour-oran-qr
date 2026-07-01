import { NextResponse } from "next/server";
import { clearTableMaster } from "@/lib/table-master";
import { clearTableDraftCart } from "@/lib/table-draft-cart";
import { releaseTable } from "@/lib/table-occupancy";
import { closeOpenDineInOrdersForTable } from "@/lib/table-release";
import { assertStaffSession } from "@/lib/staff-session";
import { printTableCustomerTicketToConfiguredPrinter } from "@/lib/printer-service";

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
    // Ticket client cumulé imprimé automatiquement avant clôture (passage en caisse).
    let customerTicketPrinted = false;
    let customerTicketError: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await printTableCustomerTicketToConfiguredPrinter(tableId, { force: true });
        customerTicketPrinted = true;
        customerTicketError = null;
        break;
      } catch (printErr) {
        customerTicketError =
          printErr instanceof Error ? printErr.message : String(printErr);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
    if (!customerTicketPrinted) {
      console.warn("[kitchen/tables/release] ticket client non imprimé:", customerTicketError);
    }

    const closedOrders = await closeOpenDineInOrdersForTable(tableId);
    const released = await releaseTable(tableId);
    await clearTableMaster(tableId);
    await clearTableDraftCart(tableId);
    return NextResponse.json({
      ok: true,
      released,
      closedOrders,
      customerTicketPrinted,
      customerTicketError,
      message: released ? "Table libérée" : "Table réinitialisée",
    });
  } catch (error: unknown) {
    console.error("[kitchen/tables/release]", error);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

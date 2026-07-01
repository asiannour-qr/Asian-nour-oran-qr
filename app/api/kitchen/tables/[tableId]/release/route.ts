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
    // On l'imprime tant que l'occupation existe encore pour agréger toute la session.
    let customerTicketPrinted = false;
    try {
      await printTableCustomerTicketToConfiguredPrinter(tableId, { force: true });
      customerTicketPrinted = true;
    } catch (printErr) {
      // Pas de commande à imprimer ou imprimante indisponible : on n'empêche pas la libération.
      console.warn("[kitchen/tables/release] ticket client non imprimé:", printErr);
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
      message: released ? "Table libérée" : "Table réinitialisée",
    });
  } catch (error: unknown) {
    console.error("[kitchen/tables/release]", error);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

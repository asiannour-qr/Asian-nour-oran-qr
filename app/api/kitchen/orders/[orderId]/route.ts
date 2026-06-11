import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPEN_STATUSES = new Set(["NEW", "IN_PROGRESS", "READY"]);

/** Retire une commande sur place de la liste serveur (suppression ou annulation). */
export async function DELETE(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  const orderId = String(params.orderId).trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Commande introuvable" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tableId: true, status: true, type: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, message: "Commande introuvable" }, { status: 404 });
    }

    if (order.tableId === "EMPORTER" || order.type === "TAKEAWAY") {
      return NextResponse.json(
        { ok: false, message: "Action réservée aux commandes sur place" },
        { status: 400 }
      );
    }

    if (OPEN_STATUSES.has(order.status)) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "CANCELED" },
      });
      return NextResponse.json({ ok: true, action: "canceled" });
    }

    if (order.status === "SERVED" || order.status === "CANCELED") {
      await prisma.order.delete({ where: { id: orderId } });
      return NextResponse.json({ ok: true, action: "deleted" });
    }

    return NextResponse.json(
      { ok: false, message: "Impossible de retirer cette commande" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("[kitchen/orders/DELETE]", error);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

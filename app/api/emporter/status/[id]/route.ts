import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Suivi public d'une commande à emporter : l'id (cuid) fait office de jeton,
// et seuls le statut et le code personnage sont exposés.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = String(params?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id, type: "TAKEAWAY" },
      select: { status: true, code: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    const res = NextResponse.json({ ok: true, status: order.status, code: order.code });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (err) {
    console.error("[emporter/status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

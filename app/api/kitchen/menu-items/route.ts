import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liste complète des articles pour la tablette serveur. */
export async function GET() {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  try {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ category: "asc" }, { position: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[kitchen/menu-items/GET]", message);
    return NextResponse.json(
      { items: [], error: "Erreur lors de la récupération du menu" },
      { status: 500 }
    );
  }
}

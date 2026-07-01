import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import { suggestReplacements } from "@/lib/rh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Marque le créneau « absent » et renvoie les remplaçants suggérés. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // corps optionnel
  }
  const reason = String(body.reason ?? "Imprévu").trim() || "Imprévu";
  const note = body.note ? String(body.note).trim() : null;

  try {
    const shift = await prisma.shift.findUnique({ where: { id: params.id } });
    if (!shift) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });

    await prisma.$transaction([
      prisma.shift.update({ where: { id: shift.id }, data: { status: "ABSENT" } }),
      prisma.absence.upsert({
        where: { shiftId: shift.id },
        create: { shiftId: shift.id, reason, note },
        update: { reason, note, resolved: false, replacedById: null },
      }),
    ]);

    const suggestions = await suggestReplacements(shift);
    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    console.error("[rh/absence/POST]", err);
    return NextResponse.json({ error: "Erreur absence" }, { status: 500 });
  }
}

/** Annule l'absence (retour PLANNED). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;
  try {
    await prisma.$transaction([
      prisma.absence.deleteMany({ where: { shiftId: params.id } }),
      prisma.shift.update({ where: { id: params.id }, data: { status: "PLANNED" } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rh/absence/DELETE]", err);
    return NextResponse.json({ error: "Erreur annulation" }, { status: 500 });
  }
}

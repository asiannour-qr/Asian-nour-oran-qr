import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Affecte un remplaçant : marque l'absence résolue et planifie le remplaçant. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const replacedById = String(body.replacedById ?? "").trim();
  if (!replacedById) return NextResponse.json({ error: "Remplaçant requis" }, { status: 400 });

  try {
    const shift = await prisma.shift.findUnique({ where: { id: params.id } });
    if (!shift) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });

    const [, , replacementShift] = await prisma.$transaction([
      prisma.shift.update({ where: { id: shift.id }, data: { status: "REPLACED" } }),
      prisma.absence.update({
        where: { shiftId: shift.id },
        data: { replacedById, resolved: true },
      }),
      prisma.shift.create({
        data: {
          employeeId: replacedById,
          date: shift.date,
          role: shift.role,
          startMin: shift.startMin,
          endMin: shift.endMin,
        },
        include: { employee: true },
      }),
    ]);

    return NextResponse.json({ ok: true, replacementShift });
  } catch (err) {
    console.error("[rh/replace/POST]", err);
    return NextResponse.json({ error: "Erreur affectation" }, { status: 500 });
  }
}

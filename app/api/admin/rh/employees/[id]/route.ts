import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    data.name = v;
  }
  if (typeof body.role === "string" && body.role.trim()) data.role = body.role.trim();
  if ("phone" in body) data.phone = body.phone ? String(body.phone).trim() : null;
  if ("notes" in body) data.notes = body.notes ? String(body.notes).trim() : null;
  if (typeof body.isExtra === "boolean") data.isExtra = body.isExtra;
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const employee = await prisma.employee.update({ where: { id: params.id }, data });
    return NextResponse.json({ employee });
  } catch (err) {
    console.error("[rh/employees/PATCH]", err);
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;
  try {
    // Suppression douce : on désactive (préserve l'historique des créneaux).
    await prisma.employee.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rh/employees/DELETE]", err);
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
  }
}

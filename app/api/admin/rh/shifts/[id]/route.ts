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
  if (typeof body.role === "string" && body.role.trim()) data.role = body.role.trim();
  if (typeof body.employeeId === "string" && body.employeeId.trim()) data.employeeId = body.employeeId.trim();
  if (body.startMin != null) data.startMin = Number(body.startMin);
  if (body.endMin != null) data.endMin = Number(body.endMin);

  try {
    const shift = await prisma.shift.update({ where: { id: params.id }, data, include: { employee: true } });
    return NextResponse.json({ shift });
  } catch (err) {
    console.error("[rh/shifts/PATCH]", err);
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;
  try {
    await prisma.shift.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rh/shifts/DELETE]", err);
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
  }
}

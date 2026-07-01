import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import { dayDate } from "@/lib/rh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const employeeId = String(body.employeeId ?? "").trim();
  const dk = String(body.dateKey ?? "").trim();
  const role = String(body.role ?? "").trim();
  const startMin = Number(body.startMin);
  const endMin = Number(body.endMin);

  if (!employeeId) return NextResponse.json({ error: "Employé requis" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Poste requis" }, { status: 400 });
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin < 0 || endMin > 1440 || startMin >= endMin) {
    return NextResponse.json({ error: "Horaires invalides" }, { status: 400 });
  }

  try {
    const shift = await prisma.shift.create({
      data: { employeeId, date: dayDate(dk), role, startMin, endMin },
      include: { employee: true },
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (err) {
    console.error("[rh/shifts/POST]", err);
    return NextResponse.json({ error: "Erreur création créneau" }, { status: 500 });
  }
}

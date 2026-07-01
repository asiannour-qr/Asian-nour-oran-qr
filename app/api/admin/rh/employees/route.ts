import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;
  try {
    const employees = await prisma.employee.findMany({
      orderBy: [{ isExtra: "asc" }, { role: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ employees });
  } catch (err) {
    console.error("[rh/employees/GET]", err);
    return NextResponse.json({ error: "Erreur chargement" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Poste requis" }, { status: 400 });

  try {
    const employee = await prisma.employee.create({
      data: {
        name,
        role,
        phone: body.phone ? String(body.phone).trim() : null,
        isExtra: Boolean(body.isExtra),
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (err) {
    console.error("[rh/employees/POST]", err);
    return NextResponse.json({ error: "Erreur création" }, { status: 500 });
  }
}

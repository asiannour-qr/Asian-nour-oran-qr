import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  const id = String(params?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "id manquant" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.available != null) {
      data.available = Boolean(body.available);
      if (data.available === true) {
        data.hideWhenUnavailable = false;
      }
    }
    if (body.hideWhenUnavailable != null) {
      data.hideWhenUnavailable = Boolean(body.hideWhenUnavailable);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, message: "aucune donnée valide" }, { status: 400 });
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  const id = String(params?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "id manquant" }, { status: 400 });
  }

  try {
    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

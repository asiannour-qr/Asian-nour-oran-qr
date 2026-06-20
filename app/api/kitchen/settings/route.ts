import { NextResponse } from "next/server";
import { assertStaffSession } from "@/lib/staff-session";
import { getSettings, upsertSettings } from "@/lib/settings";
import { clampTableCount } from "@/lib/table-count";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  try {
    const settings = await getSettings();
    return NextResponse.json({ tableCount: settings.tableCount });
  } catch (err) {
    console.error("[kitchen/settings/GET]", err);
    return NextResponse.json({ error: "Erreur chargement" }, { status: 500 });
  }
}

/** Met à jour le nombre de tables (QR codes) depuis la tablette serveur. */
export async function PATCH(req: Request) {
  const unauthorized = assertStaffSession();
  if (unauthorized) return unauthorized;

  let body: { tableCount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Corps JSON invalide" }, { status: 400 });
  }

  if (body.tableCount == null) {
    return NextResponse.json({ ok: false, message: "tableCount requis" }, { status: 400 });
  }

  try {
    const updated = await upsertSettings({ tableCount: clampTableCount(body.tableCount) });
    return NextResponse.json({ ok: true, tableCount: updated.tableCount });
  } catch (err) {
    console.error("[kitchen/settings/PATCH]", err);
    return NextResponse.json({ ok: false, message: "Erreur sauvegarde" }, { status: 500 });
  }
}

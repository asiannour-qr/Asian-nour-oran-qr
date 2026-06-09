import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { getSettings, upsertSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await getSettings());
  } catch (err) {
    console.error("[admin/settings/GET]", err);
    return NextResponse.json({ error: "Erreur chargement" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: Partial<Settings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const patch: Partial<Settings> = {};

  if (typeof body.restaurantName === "string") {
    const v = body.restaurantName.trim();
    if (!v) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    patch.restaurantName = v;
  }
  if ("address" in body) patch.address = body.address ? String(body.address).trim() : null;
  if ("phone" in body) patch.phone = body.phone ? String(body.phone).trim() : null;
  if (typeof body.tableCount === "number") {
    const n = Math.max(1, Math.min(500, Math.round(body.tableCount)));
    patch.tableCount = n;
  }
  if (typeof body.kitchenSoundEnabled === "boolean") patch.kitchenSoundEnabled = body.kitchenSoundEnabled;
  if (typeof body.autoPrintEnabled === "boolean") patch.autoPrintEnabled = body.autoPrintEnabled;
  if (body.openingHours && typeof body.openingHours === "object") patch.openingHours = body.openingHours;

  try {
    const updated = await upsertSettings(patch);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[admin/settings/PUT]", err);
    return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 });
  }
}

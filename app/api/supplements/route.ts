import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Liste publique des suppléments proposés au client (QR & emporter).
export async function GET() {
  try {
    const settings = await getSettings();
    const res = NextResponse.json({ supplements: settings.clientSupplements });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch {
    return NextResponse.json({ supplements: [] });
  }
}

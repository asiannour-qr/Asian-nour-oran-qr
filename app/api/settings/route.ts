import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getSettings();
    const res = NextResponse.json(settings);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (err) {
    console.error("[/api/settings]", err);
    return NextResponse.json(
      { error: "Impossible de charger les réglages" },
      { status: 500 }
    );
  }
}

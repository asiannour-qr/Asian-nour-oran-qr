import { NextResponse } from "next/server";
import { isPrinterConfigured } from "@/lib/printer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const configured = await isPrinterConfigured();
    return NextResponse.json({ configured });
  } catch (error: unknown) {
    console.error("[kitchen/printer/GET]", error);
    return NextResponse.json({ configured: false }, { status: 500 });
  }
}

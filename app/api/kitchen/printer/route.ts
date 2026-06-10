import { NextResponse } from "next/server";
import { getPrintersStatus } from "@/lib/printer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getPrintersStatus();
    return NextResponse.json({
      configured: status.kitchen,
      kitchen: status.kitchen,
      customer: status.customer,
    });
  } catch (error: unknown) {
    console.error("[kitchen/printer/GET]", error);
    return NextResponse.json({ configured: false, kitchen: false, customer: false }, { status: 500 });
  }
}

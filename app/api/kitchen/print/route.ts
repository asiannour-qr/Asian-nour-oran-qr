import { NextResponse } from "next/server";
import { printOrderTicketToConfiguredPrinter, type TicketVariant } from "@/lib/printer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { orderId?: unknown; variant?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId requis" }, { status: 400 });
  }

  const variant: TicketVariant = body.variant === "customer" ? "customer" : "kitchen";

  try {
    await printOrderTicketToConfiguredPrinter(orderId, variant);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[kitchen/print]", error);

    if (message.includes("non configurée")) {
      return NextResponse.json({ error: message, configured: false }, { status: 404 });
    }
    if (message === "Commande introuvable") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: `Échec impression : ${message}` }, { status: 502 });
  }
}

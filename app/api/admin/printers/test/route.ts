import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { printTestTicketToConfiguredPrinter, type TicketVariant } from "@/lib/printer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let variant: TicketVariant = "kitchen";
  try {
    const body = await req.json();
    if (body?.role === "customer") variant = "customer";
  } catch {
    // corps vide → test cuisine
  }

  try {
    const { ip, port } = await printTestTicketToConfiguredPrinter(variant);
    const place = variant === "customer" ? "caisse" : "cuisine";
    return NextResponse.json({
      ok: true,
      message: `Ticket de test ${place} envoyé à ${ip}:${port}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[admin/printers/test]", error);

    if (message.includes("non configurée")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: `Échec de l'impression de test : ${message}` },
      { status: 502 }
    );
  }
}

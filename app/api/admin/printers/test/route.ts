import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { printTestTicketToConfiguredPrinter } from "@/lib/printer-service";
import { parsePrinterRole, type PrinterTarget } from "@/lib/printer-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let target: PrinterTarget = "kitchen";
  try {
    const body = await req.json();
    target = parsePrinterRole(body?.role) ?? "kitchen";
  } catch {
    // corps vide → test cuisine
  }

  try {
    const { ip, port } = await printTestTicketToConfiguredPrinter(target);
    const place =
      target === "customer" ? "caisse" : target === "extra" ? "supplémentaire" : "cuisine";
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

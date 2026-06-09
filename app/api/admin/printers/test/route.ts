import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { printTestTicketToConfiguredPrinter } from "@/lib/printer-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const { ip, port } = await printTestTicketToConfiguredPrinter();
    return NextResponse.json({
      ok: true,
      message: `Ticket de test envoyé à ${ip}:${port}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[admin/printers/test]", error);

    if (message === "Aucune imprimante configurée") {
      return NextResponse.json(
        { error: "Aucune imprimante configurée. Enregistrez une IP et un port d'abord." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Échec de l'impression de test : ${message}` },
      { status: 502 }
    );
  }
}

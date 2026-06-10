import { NextResponse } from "next/server";

/** Vérifie le jeton partagé de l'agent d'impression (Authorization: Bearer …). */
export function assertAgentToken(req: Request): NextResponse | null {
  const expected = process.env.PRINT_AGENT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "PRINT_AGENT_TOKEN non configuré sur le serveur" },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return null;
}

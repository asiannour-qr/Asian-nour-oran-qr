import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { getCredential, updateCredentialProfile, upsertCredential } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (username.length < 3) {
    return NextResponse.json({ error: "L'identifiant doit faire au moins 3 caractères." }, { status: 400 });
  }

  if (password) {
    if (password.length < 4) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 4 caractères." }, { status: 400 });
    }
    await upsertCredential("KITCHEN", { username, password });
    return NextResponse.json({ ok: true });
  }

  const existing = await getCredential("KITCHEN");
  if (!existing) {
    return NextResponse.json(
      { error: "Définissez un mot de passe pour créer le compte cuisine." },
      { status: 400 }
    );
  }
  await updateCredentialProfile("KITCHEN", { username });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import { getAdminCreds } from "@/lib/auth";
import {
  getCredential,
  updateCredentialProfile,
  upsertCredential,
  verifyAdminPassword,
} from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const admin = await getCredential("ADMIN");
  const kitchen = await getCredential("KITCHEN");
  const envCreds = getAdminCreds();

  return NextResponse.json({
    admin: {
      username: admin?.username ?? envCreds.user ?? "",
      email: admin?.email ?? null,
      source: admin ? "db" : "env",
    },
    kitchen: {
      username: kitchen?.username ?? "",
      configured: Boolean(kitchen),
    },
  });
}

export async function PUT(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "").trim();
  const email = body?.email != null ? String(body.email).trim() : "";
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (username.length < 3) {
    return NextResponse.json({ error: "L'identifiant doit faire au moins 3 caractères." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  const okCurrent = await verifyAdminPassword(currentPassword);
  if (!okCurrent) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 6 caractères." }, { status: 400 });
    }
    await upsertCredential("ADMIN", { username, email, password: newPassword });
    return NextResponse.json({ ok: true });
  }

  // Pas de nouveau mot de passe : on met à jour le profil si le compte existe déjà en base
  const existing = await getCredential("ADMIN");
  if (!existing) {
    return NextResponse.json(
      { error: "Définissez un nouveau mot de passe pour activer votre compte." },
      { status: 400 }
    );
  }
  await updateCredentialProfile("ADMIN", { username, email });
  return NextResponse.json({ ok: true });
}

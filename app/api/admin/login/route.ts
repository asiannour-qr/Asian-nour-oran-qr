import { NextResponse } from "next/server";
import { verifyAdminLogin } from "@/lib/credentials";
import { createSessionToken } from "@/lib/session-node";
import { checkLoginAllowed, clearLoginAttempts, getClientIp, recordFailedLogin } from "@/lib/login-rate-limit";

export const runtime = "nodejs";

const EIGHT_HOURS = 8 * 60 * 60;

type Credentials = {
  user?: string;
  pass?: string;
};

export async function POST(request: Request) {
  let body: Credentials;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const retryAfter = checkLoginAllowed("admin", ip);
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const identifier = (body?.user ?? "").trim();
  const password = body?.pass ?? "";
  if (!identifier || !password) {
    recordFailedLogin("admin", ip);
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const ok = await verifyAdminLogin(identifier, password);
  if (!ok) {
    recordFailedLogin("admin", ip);
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  clearLoginAttempts("admin", ip);

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: "admin",
    value: createSessionToken("ADMIN", EIGHT_HOURS),
    httpOnly: true,
    sameSite: "lax",
    maxAge: EIGHT_HOURS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

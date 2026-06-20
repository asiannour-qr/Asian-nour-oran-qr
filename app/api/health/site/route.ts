import { NextResponse } from "next/server";
import { SITE_CONFIG } from "@/lib/site";

export const dynamic = "force-dynamic";

function authSecretStatus(): "ok" | "weak" | "missing" {
  if (process.env.AUTH_SECRET?.trim()) return "ok";
  if (process.env.NODE_ENV === "production") return "weak";
  return "missing";
}

/** Vérifie la config instance (devise, fuseau, secret) — utile après déploiement. */
export async function GET() {
  const authSecret = authSecretStatus();
  return NextResponse.json({
    ok: authSecret !== "weak",
    currency: SITE_CONFIG.currency,
    currencyLocale: SITE_CONFIG.currencyLocale,
    timeZone: SITE_CONFIG.timeZone,
    authSecret,
    ...(authSecret === "weak"
      ? { warning: "Définissez AUTH_SECRET en production (valeur aléatoire longue)." }
      : {}),
  });
}

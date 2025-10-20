import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth";

function isLegacySession(value: string | undefined | null) {
  return typeof value === "string" && value.startsWith("ok:");
}

function isModernSession(value: string | undefined | null) {
  return value === "1";
}

export function assertAdminSession() {
  const jar = cookies();
  const legacy = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const modern = jar.get("admin")?.value;

  if (isLegacySession(legacy) || isModernSession(modern)) {
    return null;
  }

  return NextResponse.json({ status: "error", message: "Non autorisé" }, { status: 401 });
}

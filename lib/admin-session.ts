import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session-node";

export function assertAdminSession() {
  const token = cookies().get("admin")?.value;

  if (verifySessionToken(token, "ADMIN")) {
    return null;
  }

  return NextResponse.json({ status: "error", message: "Non autorisé" }, { status: 401 });
}

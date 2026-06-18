import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session-node";
import { STAFF_DEVICE_PREFIX } from "@/lib/table-contract";

/** Session cuisine ou admin (tablette serveur / staff). */
export function assertStaffSession() {
  const kitchen = cookies().get("kitchen")?.value;
  const admin = cookies().get("admin")?.value;

  if (verifySessionToken(kitchen, "KITCHEN") || verifySessionToken(admin, "ADMIN")) {
    return null;
  }

  return NextResponse.json({ ok: false, message: "Non autorisé" }, { status: 401 });
}

export function isStaffDeviceId(deviceId: string | null | undefined): boolean {
  return Boolean(deviceId && deviceId.startsWith(STAFF_DEVICE_PREFIX));
}

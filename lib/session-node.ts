/**
 * Jetons de session signés (HMAC-SHA256) — version Node (sync).
 * Format : ROLE.expirationMs.signatureBase64url
 * Doit produire exactement les mêmes signatures que lib/session-edge.ts.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";

export type SessionRole = "ADMIN" | "KITCHEN";

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionToken(role: SessionRole, ttlSeconds: number): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${role}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | null | undefined, role: SessionRole): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [r, expStr, sig] = parts;
  if (r !== role) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(`${r}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

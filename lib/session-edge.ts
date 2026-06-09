/**
 * Vérification des jetons de session — version Edge (Web Crypto, async).
 * Utilisée par le middleware. Même format que lib/session-node.ts :
 * ROLE.expirationMs.signatureBase64url
 */
import { getAuthSecret } from "@/lib/auth-secret";

export type SessionRole = "ADMIN" | "KITCHEN";

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(sig);
}

export async function verifySessionTokenEdge(
  token: string | null | undefined,
  role: SessionRole
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [r, expStr, sig] = parts;
  if (r !== role) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await sign(`${r}.${expStr}`);
  return sig === expected;
}

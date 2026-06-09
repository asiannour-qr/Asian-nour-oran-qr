import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import prisma from "@/lib/prisma";
import { getAdminCreds } from "@/lib/auth";

const scrypt = promisify(scryptCb);

export type CredentialRole = "ADMIN" | "KITCHEN";

const KEY_LEN = 64;

/** Hash un mot de passe en `salt:hash` (scrypt). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(plain, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Vérifie un mot de passe contre un hash `salt:hash`. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(plain, salt, KEY_LEN)) as Buffer;
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

export async function getCredential(role: CredentialRole) {
  return prisma.appCredential.findUnique({ where: { role } });
}

export async function upsertCredential(
  role: CredentialRole,
  data: { username: string; email?: string | null; password: string }
) {
  const passwordHash = await hashPassword(data.password);
  return prisma.appCredential.upsert({
    where: { role },
    create: {
      role,
      username: data.username.trim(),
      email: data.email?.trim() || null,
      passwordHash,
    },
    update: {
      username: data.username.trim(),
      email: data.email?.trim() || null,
      passwordHash,
    },
  });
}

/** Met à jour uniquement identifiant/email (sans toucher au mot de passe). */
export async function updateCredentialProfile(
  role: CredentialRole,
  data: { username: string; email?: string | null }
) {
  return prisma.appCredential.update({
    where: { role },
    data: {
      username: data.username.trim(),
      email: data.email?.trim() || null,
    },
  });
}

/**
 * Vérifie un login ADMIN.
 * - Si un compte existe en base : identifiant OU email + mot de passe.
 * - Sinon : repli sur les variables d'environnement (continuité d'accès).
 */
export async function verifyAdminLogin(identifier: string, password: string): Promise<boolean> {
  const id = identifier.trim().toLowerCase();
  const cred = await getCredential("ADMIN");

  if (cred) {
    const matchesId =
      cred.username.trim().toLowerCase() === id ||
      (cred.email ? cred.email.trim().toLowerCase() === id : false);
    if (!matchesId) return false;
    return verifyPassword(password, cred.passwordHash);
  }

  // Repli .env
  const { user, pass } = getAdminCreds();
  if (!user || !pass) return false;
  return id === user.trim().toLowerCase() && password === pass;
}

/** Vérifie le mot de passe ADMIN actuel (DB sinon .env). Sert aux changements sensibles. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const cred = await getCredential("ADMIN");
  if (cred) return verifyPassword(password, cred.passwordHash);
  const { pass } = getAdminCreds();
  return Boolean(pass) && password === pass;
}

/** Vérifie un login CUISINE (uniquement en base). */
export async function verifyKitchenLogin(identifier: string, password: string): Promise<boolean> {
  const id = identifier.trim().toLowerCase();
  const cred = await getCredential("KITCHEN");
  if (!cred) return false;
  if (cred.username.trim().toLowerCase() !== id) return false;
  return verifyPassword(password, cred.passwordHash);
}

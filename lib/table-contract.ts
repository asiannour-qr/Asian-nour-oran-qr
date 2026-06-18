/**
 * Contrat unique du système table (QR convive + mode serveur).
 * Toute modification de ce fichier doit être accompagnée du test `npm run test:handoff`.
 */

/** Préfixe des deviceId tablette serveur — ne pas dupliquer ailleurs. */
export const STAFF_DEVICE_PREFIX = "staff-serv-" as const;

/** Longueur minimale d'un deviceId client ou staff. */
export const MIN_TABLE_DEVICE_ID_LENGTH = 8;

/** Table isolée réservée aux tests automatisés (jamais une table client réelle). */
export const TEST_HANDOFF_TABLE_ID = "99";

export function normalizeTableId(tableId: string | null | undefined): string {
  return String(tableId ?? "").trim();
}

export function getStaffTableDeviceId(tableId: string): string {
  return `${STAFF_DEVICE_PREFIX}${normalizeTableId(tableId)}`;
}

export function isStaffTableDeviceId(deviceId: string | null | undefined): boolean {
  return Boolean(deviceId && deviceId.startsWith(STAFF_DEVICE_PREFIX));
}

export function isValidTableDeviceId(deviceId: string | null | undefined): boolean {
  return Boolean(deviceId && deviceId.length >= MIN_TABLE_DEVICE_ID_LENGTH);
}

/** Modèles Prisma requis pour le handoff convive ↔ serveur. */
export const TABLE_SYSTEM_PRISMA_MODELS = ["tableOrderMaster", "tableDraftCart"] as const;

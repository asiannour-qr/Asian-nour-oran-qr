import type { Prisma } from "@prisma/client";
import { sanitizeGuestNamesRecord } from "@/lib/guest-name-utils";
import { getGuestNames as getGuestNamesMemory } from "@/lib/guest-names-store";

export type GuestNamesMap = Record<string, string>;

export function parseOrderGuestNames(value: unknown): GuestNamesMap | null {
  const parsed = sanitizeGuestNamesRecord(
    value && typeof value === "object" && !Array.isArray(value) ? (value as GuestNamesMap) : null
  );
  return Object.keys(parsed).length > 0 ? parsed : null;
}

/** Noms convives : colonne Order en priorité, repli mémoire (anciennes commandes). */
export function resolveOrderGuestNames(order: {
  id: string;
  guestNames?: unknown;
}): GuestNamesMap | null {
  const fromDb = parseOrderGuestNames(order.guestNames);
  if (fromDb) return fromDb;
  return getGuestNamesMemory(order.id);
}

export function guestNamesToJson(
  value: GuestNamesMap | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value || Object.keys(value).length === 0) return undefined;
  return value as Prisma.InputJsonValue;
}

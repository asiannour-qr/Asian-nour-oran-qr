import { sanitizeGuestNamesRecord } from "./guest-name-utils";

type GuestNamesMap = Record<string, string>;

const orderStoreRef = globalThis as unknown as {
  __GUEST_NAMES_STORE__?: Map<string, GuestNamesMap>;
};

if (!orderStoreRef.__GUEST_NAMES_STORE__) {
  orderStoreRef.__GUEST_NAMES_STORE__ = new Map<string, GuestNamesMap>();
}

const ORDER_STORE: Map<string, GuestNamesMap> = orderStoreRef.__GUEST_NAMES_STORE__!;

export function storeGuestNames(orderId: string, guestNames: GuestNamesMap | null | undefined) {
  if (!guestNames || Object.keys(guestNames).length === 0) {
    ORDER_STORE.delete(orderId);
    return;
  }
  ORDER_STORE.set(orderId, guestNames);
}

export function getGuestNames(orderId: string): GuestNamesMap | null {
  return ORDER_STORE.get(orderId) ?? null;
}

const TABLE_KEY_PREFIX = "guestNames:table:";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type StoredGuestNamesPayload = {
  guestNames: GuestNamesMap;
  updatedAt: number;
};

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDefaultGuestNames(count = 1): GuestNamesMap {
  const normalized = Math.max(1, Math.round(Number(count) || 1));
  const map: GuestNamesMap = {};
  for (let i = 1; i <= normalized; i += 1) {
    // defaults are implicit via guestNameFallback, so we keep map empty unless custom names exist
    // map[String(i)] = guestNameFallback(i); // intentionally omitted
  }
  return map;
}

function buildTableKey(tableId: string) {
  return `${TABLE_KEY_PREFIX}${tableId}`;
}

export function persistGuestNamesForTable(tableId: string, guestNames: GuestNamesMap) {
  if (!hasLocalStorage()) return;
  const payload: StoredGuestNamesPayload = {
    guestNames,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(buildTableKey(tableId), JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function loadGuestNamesForTable(tableId: string, count?: number): GuestNamesMap {
  if (!hasLocalStorage()) return getDefaultGuestNames(count);
  try {
    const raw = window.localStorage.getItem(buildTableKey(tableId));
    if (!raw) return getDefaultGuestNames(count);
    const parsed = JSON.parse(raw) as StoredGuestNamesPayload | GuestNamesMap | null;
    if (!parsed) return getDefaultGuestNames(count);

    if (typeof parsed === "object" && "guestNames" in parsed && "updatedAt" in parsed) {
      const payload = parsed as StoredGuestNamesPayload;
      if (Date.now() - payload.updatedAt > TWO_HOURS_MS) {
        resetGuestNames(tableId);
        return getDefaultGuestNames(count);
      }
      return sanitizeGuestNamesRecord(payload.guestNames, { count });
    }

    return sanitizeGuestNamesRecord(parsed as GuestNamesMap, { count });
  } catch {
    return getDefaultGuestNames(count);
  }
}

export function resetGuestNames(tableId: string): GuestNamesMap {
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(buildTableKey(tableId));
    } catch {
      // ignore
    }
  }
  return getDefaultGuestNames();
}

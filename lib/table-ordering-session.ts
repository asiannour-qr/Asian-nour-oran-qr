const SESSION_SUFFIX = ":ordering-session";

function sessionKey(tableId: string) {
  return `table:${tableId}${SESSION_SUFFIX}`;
}

/** Onglet encore en commande active (sessionStorage = vie du tab). */
export function isOrderingSessionActive(tableId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(sessionKey(tableId)) === "1";
  } catch {
    return false;
  }
}

export function markOrderingSessionActive(tableId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionKey(tableId), "1");
  } catch {
    // ignore
  }
}

export function clearOrderingSessionActive(tableId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(sessionKey(tableId));
  } catch {
    // ignore
  }
}

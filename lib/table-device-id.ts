const STORAGE_KEY = "table:deviceId";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Identifiant stable par navigateur, pour le rôle « téléphone maître ». */
export function getOrCreateTableDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

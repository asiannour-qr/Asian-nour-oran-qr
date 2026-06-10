export const KITCHEN_SOUND_STORAGE_KEY = "kitchen:soundEnabled";

/** Son activé par défaut ; seul `"0"` en localStorage le coupe. */
export function readSoundEnabledPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== "0";
}

export function writeSoundEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KITCHEN_SOUND_STORAGE_KEY, enabled ? "1" : "0");
}

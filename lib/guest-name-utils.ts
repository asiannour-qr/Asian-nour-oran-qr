export function guestNameFallback(index: number): string {
  return `P${index}`;
}

export function sanitizeGuestNameInput(value: unknown): string {
  if (typeof value !== "string") return "";
  let normalized = value.normalize("NFKC");
  normalized = normalized.replace(/[^\p{L}\p{N} _\-\.'’]/gu, "");
  normalized = normalized.replace(/’/gu, "'");
  normalized = normalized.replace(/\s+/g, " ").trim();
  if (normalized.length > 16) {
    normalized = normalized.slice(0, 16).trim();
  }
  return normalized;
}

type SanitizeOptions = {
  count?: number;
};

export function sanitizeGuestNamesRecord(source: unknown, options: SanitizeOptions = {}): Record<string, string> {
  if (!source || typeof source !== "object") return {};
  const result: Record<string, string> = {};
  const entries = Object.entries(source as Record<string, unknown>);

  for (const [rawKey, rawValue] of entries) {
    let index = Number.NaN;
    if (typeof rawKey === "string" && rawKey.startsWith("P")) {
      index = Number(rawKey.slice(1));
    } else {
      index = Number(rawKey);
    }
    if (!Number.isInteger(index) || index <= 0) continue;
    if (options.count && index > options.count) continue;

    const sanitized = sanitizeGuestNameInput(rawValue);
    if (!sanitized) continue;
    if (sanitized === guestNameFallback(index)) continue;
    result[String(index)] = sanitized;
  }

  return result;
}

export function guestNameFromMap(
  map: Record<string, string> | null | undefined,
  personId: string | null | undefined
): string {
  if (!personId) return guestNameFallback(1);
  const match = /^P?(\d+)$/i.exec(personId.trim());
  const index = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(index) || index <= 0) return personId;
  const custom = map?.[String(index)];
  if (custom && custom.trim()) return custom.trim();
  return guestNameFallback(index);
}

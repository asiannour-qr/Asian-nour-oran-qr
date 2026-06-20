import type { DayHours, OpeningHours } from "@/lib/settings";

export function normalizeDayHours(raw: Partial<DayHours> | null | undefined): DayHours {
  return {
    ouvert: raw?.ouvert !== false,
    debut: String(raw?.debut ?? "11:30").slice(0, 5),
    fin: String(raw?.fin ?? "22:00").slice(0, 5),
    debut2: raw?.debut2 ? String(raw.debut2).slice(0, 5) : undefined,
    fin2: raw?.fin2 ? String(raw.fin2).slice(0, 5) : undefined,
    continu: raw?.continu === true,
  };
}

export function normalizeOpeningHours(
  raw: Record<string, Partial<DayHours>> | null | undefined
): OpeningHours {
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const out: OpeningHours = {};
  for (const j of jours) {
    out[j] = normalizeDayHours(raw?.[j]);
  }
  return out;
}

function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function minutesInSlot(nowMin: number, start: number, end: number): boolean {
  if (end <= start) return nowMin >= start || nowMin <= end;
  return nowMin >= start && nowMin <= end;
}

export function isDayOpenAt(h: DayHours, nowMin: number): boolean {
  if (!h.ouvert) return false;
  const s1 = parseHm(h.debut);
  const e1 = parseHm(h.fin);
  if (s1 == null || e1 == null) return true;
  if (minutesInSlot(nowMin, s1, e1)) return true;
  if (!h.continu && h.debut2 && h.fin2) {
    const s2 = parseHm(h.debut2);
    const e2 = parseHm(h.fin2);
    if (s2 != null && e2 != null && minutesInSlot(nowMin, s2, e2)) return true;
  }
  return false;
}

export function formatDayHoursLabel(h: DayHours): string {
  if (!h.ouvert) return "Fermé";
  if (h.continu) return `${h.debut} – ${h.fin}`;
  if (h.debut2 && h.fin2) return `${h.debut} – ${h.fin} · ${h.debut2} – ${h.fin2}`;
  return `${h.debut} – ${h.fin}`;
}

export function buildWeekHours(slot: DayHours): OpeningHours {
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  return Object.fromEntries(jours.map((j) => [j, { ...slot }]));
}

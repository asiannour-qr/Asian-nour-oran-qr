import { RESTAURANT_TZ } from "@/lib/restaurant-time";
import type { OpeningHours } from "@/lib/settings";
import { JOURS } from "@/lib/settings";

const DAY_INDEX: Record<number, (typeof JOURS)[number]> = {
  0: "dimanche",
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
};

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

/** Indique si le restaurant accepte des commandes à l'instant `when` (fuseau site). */
export function isRestaurantOpen(
  openingHours: OpeningHours,
  when: Date = new Date()
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);

  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true;

  const dayKey =
    weekday.startsWith("mon")
      ? "lundi"
      : weekday.startsWith("tue")
        ? "mardi"
        : weekday.startsWith("wed")
          ? "mercredi"
          : weekday.startsWith("thu")
            ? "jeudi"
            : weekday.startsWith("fri")
              ? "vendredi"
              : weekday.startsWith("sat")
                ? "samedi"
                : weekday.startsWith("sun")
                  ? "dimanche"
                  : DAY_INDEX[when.getDay()] ?? "lundi";

  const slot = openingHours[dayKey];
  if (!slot?.ouvert) return false;

  const start = parseHm(slot.debut);
  const end = parseHm(slot.fin);
  const nowMin = hour * 60 + minute;
  if (start == null || end == null) return true;
  if (end <= start) return nowMin >= start || nowMin <= end;
  return nowMin >= start && nowMin <= end;
}

export function closedMessage(): string {
  return "Le restaurant est fermé pour le moment. Revenez pendant les horaires d'ouverture.";
}

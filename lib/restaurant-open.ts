import { isDayOpenAt, normalizeDayHours } from "@/lib/opening-hours";
import { RESTAURANT_TZ } from "@/lib/restaurant-time";
import type { OpeningHours } from "@/lib/settings";
import { JOURS } from "@/lib/settings";

export { formatDayHoursLabel } from "@/lib/opening-hours";

const DAY_INDEX: Record<number, (typeof JOURS)[number]> = {
  0: "dimanche",
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
};

function weekdayKey(parts: Intl.DateTimeFormatPart[]): (typeof JOURS)[number] {
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
  if (weekday.startsWith("mon")) return "lundi";
  if (weekday.startsWith("tue")) return "mardi";
  if (weekday.startsWith("wed")) return "mercredi";
  if (weekday.startsWith("thu")) return "jeudi";
  if (weekday.startsWith("fri")) return "vendredi";
  if (weekday.startsWith("sat")) return "samedi";
  if (weekday.startsWith("sun")) return "dimanche";
  return "lundi";
}

/** Indique si le restaurant accepte des commandes à l'instant `when` (fuseau site). */
export function isRestaurantOpen(openingHours: OpeningHours, when: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true;

  const dayKey = weekdayKey(parts) ?? DAY_INDEX[when.getDay()] ?? "lundi";
  const slot = normalizeDayHours(openingHours[dayKey]);
  return isDayOpenAt(slot, hour * 60 + minute);
}

export function closedMessage(): string {
  return "Le restaurant est fermé pour le moment. Revenez pendant les horaires d'ouverture.";
}

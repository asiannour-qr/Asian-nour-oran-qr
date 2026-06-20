import { buildWeekHours } from "@/lib/opening-hours";
import type { OpeningHours } from "@/lib/settings";

export const FLEURY_OPENING_HOURS: OpeningHours = buildWeekHours({
  ouvert: true,
  debut: "11:30",
  fin: "14:30",
  debut2: "18:30",
  fin2: "22:30",
});

export const ORAN_OPENING_HOURS: OpeningHours = buildWeekHours({
  ouvert: true,
  debut: "11:00",
  fin: "00:00",
  continu: true,
});

export const TOURS_OPENING_HOURS: OpeningHours = buildWeekHours({
  ouvert: true,
  debut: "11:30",
  fin: "14:00",
  debut2: "19:00",
  fin2: "23:00",
});

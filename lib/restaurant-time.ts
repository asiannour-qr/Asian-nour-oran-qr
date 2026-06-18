import { SITE_CONFIG } from "@/lib/site";

export const RESTAURANT_TZ = SITE_CONFIG.timeZone;

export function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function monthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: RESTAURANT_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatShortDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: RESTAURANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatMonthLabel(monthKeyValue: string): string {
  const [year, month] = monthKeyValue.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: RESTAURANT_TZ,
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatRestaurantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: RESTAURANT_TZ,
  });
}

/** @deprecated Utiliser formatRestaurantTime */
export const formatTimeAlgiers = formatRestaurantTime;

export function parseDateKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

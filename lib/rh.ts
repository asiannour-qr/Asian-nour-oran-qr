import { prisma } from "@/lib/prisma";
import type { Shift } from "@prisma/client";

/** Postes standard (modifiables côté données). */
export const RH_ROLES = ["Sushiman", "Wokman", "Serveur", "Piston"] as const;

/** Jour « métier » stocké à midi UTC pour éviter les décalages de fuseau. */
export function dayDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

/** Lundi (clé YYYY-MM-DD) de la semaine contenant `dateKey`. */
export function isoWeekStart(dateKey: string): string {
  const d = dayDate(dateKey);
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** 7 clés de jour (lundi → dimanche) à partir d'un lundi. */
export function weekDayKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = dayDate(mondayKey);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function overlaps(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/**
 * Remplaçants suggérés pour un créneau : employés actifs, non déjà occupés sur
 * un créneau qui chevauche ce jour-là. Tri : même poste puis extras.
 */
export async function suggestReplacements(shift: Shift) {
  const dayShifts = await prisma.shift.findMany({
    where: { date: shift.date, status: { not: "ABSENT" } },
    select: { employeeId: true, startMin: true, endMin: true },
  });
  const busy = new Set(
    dayShifts.filter((s) => overlaps(s, shift)).map((s) => s.employeeId)
  );
  busy.add(shift.employeeId);

  const pool = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const score = (e: { role: string; isExtra: boolean }) =>
    (e.role === shift.role ? 2 : 0) + (e.isExtra ? 1 : 0);

  return pool
    .filter((e) => !busy.has(e.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8)
    .map((e) => ({ id: e.id, name: e.name, phone: e.phone, role: e.role, isExtra: e.isExtra }));
}

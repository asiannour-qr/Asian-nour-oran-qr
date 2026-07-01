import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import { dateKey } from "@/lib/restaurant-time";
import { dayDate, isoWeekStart, weekDayKeys } from "@/lib/rh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const anchorKey = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : dateKey(new Date());
  const weekStart = isoWeekStart(anchorKey);
  const days = weekDayKeys(weekStart);

  try {
    const [employees, shifts] = await Promise.all([
      prisma.employee.findMany({
        where: { active: true },
        orderBy: [{ isExtra: "asc" }, { role: "asc" }, { name: "asc" }],
      }),
      prisma.shift.findMany({
        where: { date: { in: days.map(dayDate) } },
        include: { employee: true, absence: true },
      }),
    ]);

    const serialized = shifts.map((s) => ({
      id: s.id,
      dateKey: s.date.toISOString().slice(0, 10),
      role: s.role,
      startMin: s.startMin,
      endMin: s.endMin,
      status: s.status,
      employee: { id: s.employee.id, name: s.employee.name, phone: s.employee.phone, role: s.employee.role },
      absence: s.absence
        ? { id: s.absence.id, reason: s.absence.reason, note: s.absence.note, replacedById: s.absence.replacedById, resolved: s.absence.resolved }
        : null,
    }));

    return NextResponse.json({ weekStart, days, employees, shifts: serialized });
  } catch (err) {
    console.error("[rh/planning/GET]", err);
    return NextResponse.json({ error: "Erreur chargement planning" }, { status: 500 });
  }
}

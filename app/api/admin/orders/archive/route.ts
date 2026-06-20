import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import { resolveOrderGuestNames } from "@/lib/guest-names-db";
import {
  dateKey,
  formatDateLabel,
  formatMonthLabel,
  monthKey,
  parseDateKey,
} from "@/lib/restaurant-time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get("days") ?? 90);
    const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(7, Math.round(daysRaw))) : 90;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: fromDate },
        status: { notIn: ["CANCELED", "PENDING_PAYMENT"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: { id: true, name: true, qty: true, price: true, personId: true },
        },
      },
    });

    type DayBucket = {
      dateKey: string;
      dateLabel: string;
      orders: Array<{
        id: string;
        tableId: string;
        status: string;
        type: string | null;
        code: string | null;
        total: number;
        comment: string | null;
        createdAt: string;
        guestNames: Record<string, string> | null;
        items: { id: string; name: string; qty: number; price: number | null; personId: string | null }[];
      }>;
    };

    type MonthBucket = {
      monthKey: string;
      monthLabel: string;
      days: DayBucket[];
      orderCount: number;
    };

    const monthsMap = new Map<string, Map<string, DayBucket>>();

    for (const order of orders) {
      const mKey = monthKey(order.createdAt);
      const dKey = dateKey(order.createdAt);
      if (!monthsMap.has(mKey)) monthsMap.set(mKey, new Map());
      const daysMap = monthsMap.get(mKey)!;
      if (!daysMap.has(dKey)) {
        daysMap.set(dKey, {
          dateKey: dKey,
          dateLabel: formatDateLabel(parseDateKey(dKey)),
          orders: [],
        });
      }
      daysMap.get(dKey)!.orders.push({
        id: order.id,
        tableId: order.tableId,
        status: order.status,
        type: order.type,
        code: order.code,
        total: order.total,
        comment: order.comment,
        createdAt: order.createdAt.toISOString(),
        guestNames: resolveOrderGuestNames(order),
        items: order.items.map((it) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          personId: it.personId,
        })),
      });
    }

    const months: MonthBucket[] = Array.from(monthsMap.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([mKey, daysMap]) => {
        const days = Array.from(daysMap.values()).sort((a, b) =>
          a.dateKey < b.dateKey ? 1 : -1
        );
        const orderCount = days.reduce((sum, d) => sum + d.orders.length, 0);
        return {
          monthKey: mKey,
          monthLabel: formatMonthLabel(mKey),
          days,
          orderCount,
        };
      });

    return NextResponse.json({ ok: true, rangeDays: days, months });
  } catch (error: unknown) {
    console.error("[admin/orders/archive]", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

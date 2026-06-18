import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { csvRevenueHeaders } from "@/lib/currency";
import { RESTAURANT_TZ } from "@/lib/restaurant-time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDateLabel(date: Date) {
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: RESTAURANT_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function dateKey(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: RESTAURANT_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

type DayBucket = {
    total: number;
    dineIn: number;
    takeaway: number;
    count: number;
};

export async function GET(req: Request) {
    try {
        const today = new Date();
        const todayKey = dateKey(today);
        const fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);

        // Les commandes annulées ou jamais validées en caisse ne comptent pas dans le CA
        const orders = await prisma.order.findMany({
            where: {
                createdAt: { gte: fromDate },
                status: { notIn: ["CANCELED", "PENDING_PAYMENT"] },
            },
            select: {
                total: true,
                createdAt: true,
                type: true,
                items: { select: { name: true, qty: true, price: true } },
            },
        });

        const historyMap = new Map<string, DayBucket>();
        const productMap = new Map<string, { qty: number; revenue: number }>();

        for (const order of orders) {
            const key = dateKey(order.createdAt);
            const bucket = historyMap.get(key) ?? { total: 0, dineIn: 0, takeaway: 0, count: 0 };
            bucket.total += order.total;
            bucket.count += 1;
            if (order.type === "TAKEAWAY") {
                bucket.takeaway += order.total;
            } else {
                bucket.dineIn += order.total;
            }
            historyMap.set(key, bucket);

            for (const item of order.items) {
                const entry = productMap.get(item.name) ?? { qty: 0, revenue: 0 };
                entry.qty += item.qty ?? 1;
                entry.revenue += (item.price ?? 0) * (item.qty ?? 1);
                productMap.set(item.name, entry);
            }
        }

        const sortedEntries = Array.from(historyMap.entries()).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
        const todayBucket = historyMap.get(todayKey) ?? { total: 0, dineIn: 0, takeaway: 0, count: 0 };

        const history = sortedEntries.slice(0, 30).map(([key, bucket]) => ({
            dateLabel: formatDateLabel(new Date(`${key}T00:00:00Z`)),
            total: bucket.total,
            dineIn: bucket.dineIn,
            takeaway: bucket.takeaway,
            count: bucket.count,
        }));

        const topProducts = Array.from(productMap.entries())
            .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        // Export CSV (?format=csv) pour la comptabilité
        const url = new URL(req.url);
        if (url.searchParams.get("format") === "csv") {
            const toAmount = (cents: number) => String(Math.round(cents / 100));
            const headers = csvRevenueHeaders();
            const lines = [
                `Date;${headers.total};${headers.dineIn};${headers.takeaway};Nb commandes`,
                ...history.map((h) =>
                    [h.dateLabel, toAmount(h.total), toAmount(h.dineIn), toAmount(h.takeaway), String(h.count)].join(";")
                ),
            ];
            // BOM UTF-8 pour ouverture correcte dans Excel
            const csv = "\uFEFF" + lines.join("\r\n");
            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="ca-asian-nour-${todayKey}.csv"`,
                    "Cache-Control": "no-store",
                },
            });
        }

        const responseBody = {
            todayDateLabel: formatDateLabel(today),
            todayTotal: todayBucket.total,
            todayDineIn: todayBucket.dineIn,
            todayTakeaway: todayBucket.takeaway,
            todayCount: todayBucket.count,
            history,
            topProducts,
        };

        const res = NextResponse.json(responseBody);
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res;
    } catch (error: any) {
        console.error("[admin/ca] error", error);
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}

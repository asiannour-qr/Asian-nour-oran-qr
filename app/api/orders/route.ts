// app/api/orders/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeGuestNamesRecord } from "@/lib/guest-name-utils";
import { getGuestNames, storeGuestNames } from "@/lib/guest-names-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IncomingItem = {
    name: string;
    qty: number;
    priceCents?: number | null;
    personId?: string | null;
};

export async function GET() {
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: true },
    });
    const withGuestNames = orders.map((order) => ({
        ...order,
        guestNames: getGuestNames(order.id),
    }));
    const res = NextResponse.json({ orders: withGuestNames });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return res;
}

function maxGuestIndexFromItems(items: { personId: string | null | undefined }[]): number {
    return items.reduce((max, item) => {
        if (!item.personId) return max;
        const match = /^P?(\d+)$/i.exec(item.personId);
        if (!match) return max;
        const value = Number(match[1]);
        if (!Number.isInteger(value) || value <= 0) return max;
        return Math.max(max, value);
    }, 0);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const tableId = String(body?.tableId || "").trim();
        if (!tableId) return NextResponse.json({ status: "error", message: "tableId requis" }, { status: 400 });

        const inItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];
        if (inItems.length === 0) return NextResponse.json({ status: "error", message: "items requis" }, { status: 400 });

        // Résout prix si manquant
        const resolved: { name: string; qty: number; price: number; personId: string | null }[] = [];
        for (const it of inItems) {
            const name = String(it?.name || "").trim();
            const qty = Number(it?.qty ?? 0);
            if (!name || !Number.isInteger(qty) || qty <= 0) {
                return NextResponse.json({ status: "error", message: "item invalide (name/qty)" }, { status: 400 });
            }
            const personId = typeof it?.personId === "string" && it.personId.trim().length > 0 ? it.personId.trim() : null;

            let price = 0;
            if (it?.priceCents != null && Number.isFinite(Number(it.priceCents))) {
                price = Math.max(0, Math.round(Number(it.priceCents)));
            } else {
                const ref = await prisma.menuItem.findFirst({ where: { name } });
                price = ref?.priceCents ?? 0;
            }

            resolved.push({ name, qty, price, personId });
        }

        const computedTotal = resolved.reduce((s, r) => s + r.price * r.qty, 0);
        const total = Number.isFinite(Number(body?.total)) ? Math.max(computedTotal, Number(body.total)) : computedTotal;

        const maxGuestIndex = Math.max(
            maxGuestIndexFromItems(resolved),
            Number.isFinite(Number(body?.peopleCount)) ? Math.max(0, Number(body.peopleCount)) : 0
        );
        const sanitizedGuestNames = sanitizeGuestNamesRecord(body?.guestNames, {
            count: maxGuestIndex || undefined,
        });

        const created = await prisma.order.create({
            data: {
                tableId,
                total,
                comment: body?.comment ? String(body.comment) : null,
                status: "NEW",
                peopleCount: body?.peopleCount != null ? Number(body.peopleCount) : null,
                items: {
                    create: resolved.map(r => ({
                        name: r.name,
                        qty: r.qty,
                        price: r.price, // Int? dans le schéma → OK même à 0
                        personId: r.personId,
                    })),
                },
            },
            include: { items: true },
        });

        storeGuestNames(created.id, sanitizedGuestNames);

        const res = NextResponse.json(
            { status: "ok", order: { ...created, guestNames: sanitizedGuestNames } },
            { status: 201 }
        );
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res;
    } catch (e: any) {
        return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
    }
}

// PATCH /api/orders  (change status si besoin “kitchen”)
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const id = String(body?.id || "");
        const status = String(body?.status || "");
        if (!id || !status) return NextResponse.json({ status: "error", message: "id et status requis" }, { status: 400 });

        const updated = await prisma.order.update({
            where: { id },
            data: { status },
            include: { items: true },
        });

        return NextResponse.json({ status: "ok", order: { ...updated, guestNames: getGuestNames(updated.id) } });
    } catch (e: any) {
        return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
    }
}

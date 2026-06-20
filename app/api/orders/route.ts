// app/api/orders/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeGuestNamesRecord } from "@/lib/guest-name-utils";
import { guestNamesToJson, parseOrderGuestNames, resolveOrderGuestNames } from "@/lib/guest-names-db";
import { validateAndResolveOrderItems } from "@/lib/order-items-validation";
import { expireStalePendingTakeaway } from "@/lib/takeaway-codes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IncomingItem = {
    name: string;
    qty: number;
    priceCents?: number | null;
    personId?: string | null;
};

export async function GET() {
    try {
        // Expire les commandes à emporter jamais validées en caisse (> 1 h)
        await expireStalePendingTakeaway().catch((err) => {
            console.warn("[orders/GET] expiration emporter:", err?.message ?? err);
        });

        const orders = await prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            include: { items: true },
        });
        const withGuestNames = orders.map((order) => ({
            ...order,
            guestNames: resolveOrderGuestNames(order),
        }));
        const res = NextResponse.json({ orders: withGuestNames });
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res;
    } catch (err: any) {
        const errorMessage = err?.message ?? String(err);
        const isLocked = errorMessage.includes("database is locked") || errorMessage.includes("SQLITE_BUSY");
        console.error("[orders/GET] Prisma error:", {
            message: errorMessage,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
        });
        const res = NextResponse.json(
            {
                orders: [],
                error: isLocked
                    ? "Base de données temporairement verrouillée, réessayez dans quelques instants"
                    : "Erreur lors de la récupération des commandes",
                details: errorMessage,
                code: err?.code,
            },
            { status: isLocked ? 503 : 500 }
        );
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res;
    }
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
        const body = await req.json().catch(() => ({}));

        const tableId = String(body?.tableId || "").trim();
        if (!tableId) return NextResponse.json({ status: "error", message: "tableId requis" }, { status: 400 });

        const inItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];
        if (inItems.length === 0) return NextResponse.json({ status: "error", message: "items requis" }, { status: 400 });

        const validated = await validateAndResolveOrderItems(
            inItems.map((it) => ({
                name: String(it?.name || "").trim(),
                qty: Number(it?.qty ?? 0),
                personId: it?.personId ?? null,
            }))
        );
        if (validated.ok === false) {
            return NextResponse.json({ status: "error", message: validated.message }, { status: 400 });
        }
        const resolved = validated.items;

        const maxGuestIndex = Math.max(
            maxGuestIndexFromItems(
                resolved.map((r) => ({ personId: r.personId ?? null }))
            ),
            Number.isFinite(Number(body?.peopleCount)) ? Math.max(0, Number(body.peopleCount)) : 0
        );
        const sanitizedGuestNames = sanitizeGuestNamesRecord(body?.guestNames, {
            count: maxGuestIndex || undefined,
        });

        const created = await prisma.order.create({
            data: {
                tableId,
                total: validated.total,
                comment: body?.comment ? String(body.comment) : null,
                status: "NEW",
                peopleCount: body?.peopleCount != null ? Number(body.peopleCount) : null,
                guestNames: guestNamesToJson(sanitizedGuestNames),
                items: {
                    create: resolved.map((r) => ({
                        name: r.name,
                        qty: r.qty,
                        price: r.price,
                        personId: r.personId ?? null,
                    })),
                },
            },
            include: { items: true },
        });

        const res = NextResponse.json(
            { status: "ok", order: { ...created, guestNames: parseOrderGuestNames(created.guestNames) ?? sanitizedGuestNames } },
            { status: 201 }
        );
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return res;
    } catch (e: any) {
        const errorMessage = e?.message ?? String(e);
        const isLocked = errorMessage.includes("database is locked") || errorMessage.includes("SQLITE_BUSY");
        console.error("[orders/POST] error:", {
            message: errorMessage,
            code: e?.code,
            meta: e?.meta,
            stack: e?.stack,
        });
        return NextResponse.json(
            {
                status: "error",
                message: isLocked
                    ? "Base de données temporairement verrouillée, réessayez dans quelques instants"
                    : "Erreur lors de la création de la commande",
                details: errorMessage,
                code: e?.code,
            },
            { status: isLocked ? 503 : 500 }
        );
    }
}

// PATCH /api/orders  (change status si besoin “kitchen”)
export async function PATCH(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const id = String(body?.id || "");
        const status = String(body?.status || "");
        if (!id || !status) return NextResponse.json({ status: "error", message: "id et status requis" }, { status: 400 });

        const updated = await prisma.order.update({
            where: { id },
            data: { status },
            include: { items: true },
        });

        return NextResponse.json({ status: "ok", order: { ...updated, guestNames: resolveOrderGuestNames(updated) } });
    } catch (e: any) {
        const errorMessage = e?.message ?? String(e);
        const isLocked = errorMessage.includes("database is locked") || errorMessage.includes("SQLITE_BUSY");
        console.error("[orders/PATCH] error:", {
            message: errorMessage,
            code: e?.code,
            meta: e?.meta,
            stack: e?.stack,
        });
        return NextResponse.json(
            {
                status: "error",
                message: isLocked
                    ? "Base de données temporairement verrouillée, réessayez dans quelques instants"
                    : "Erreur lors de la mise à jour de la commande",
                details: errorMessage,
                code: e?.code,
            },
            { status: isLocked ? 503 : 500 }
        );
    }
}

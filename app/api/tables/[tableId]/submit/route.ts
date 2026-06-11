import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clearCart, getCart } from "@/lib/cart";
import { sanitizeGuestNamesRecord } from "@/lib/guest-name-utils";
import { storeGuestNames } from "@/lib/guest-names-store";
import { getTableMaster, isMasterDevice, touchTableMaster } from "@/lib/table-master";
import { z } from "zod";

/** Validation stricte du corps */
const BodySchema = z.object({
    tableComment: z.string().max(2000).optional().nullable(),
    peopleCount: z.number().int().min(1).optional(),
    items: z
        .array(
            z.object({
                name: z.string().min(1),
                price: z.number().int().nonnegative().optional(),
                qty: z.number().int().min(1),
                personId: z.string().optional().nullable(),
            })
        )
        .min(1, "Il faut au moins 1 item"),
    guestNames: z.record(z.string()).optional(),
    deviceId: z.string().min(8).optional(),
});

function sanitizePeopleCount(value: unknown): number | undefined {
    const num = Number(value);
    if (!Number.isFinite(num)) return undefined;
    return Math.max(1, Math.min(12, Math.round(num)));
}

function sanitizeItem(raw: any) {
    const name = String(raw?.name ?? "").trim();
    const qtyRaw = Number(raw?.qty ?? 0);
    const qty = Number.isFinite(qtyRaw) ? Math.max(1, Math.round(qtyRaw)) : 0;

    const priceRaw = raw?.price;
    const priceNum =
        priceRaw === null || priceRaw === undefined ? undefined : Number(priceRaw);
    const price =
        priceNum === undefined || !Number.isFinite(priceNum)
            ? undefined
            : Math.max(0, Math.round(priceNum));

    const personIdRaw = raw?.personId;
    const personIdText =
        personIdRaw === null || personIdRaw === undefined
            ? null
            : String(personIdRaw).trim() || null;

    return {
        name,
        qty,
        ...(price !== undefined ? { price } : {}),
        personId: personIdText,
    };
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

export async function POST(
    req: Request,
    { params }: { params: { tableId: string } }
) {
    try {
        const raw = await req.json().catch(() => undefined);
        const tableId = String(params.tableId);

        const bodyItems = Array.isArray(raw?.items)
            ? raw.items
                  .map(sanitizeItem)
                  .filter((it: { name: string; qty: number }) => it.name && it.qty > 0)
            : [];
        const hasTableCommentField =
            raw !== undefined && Object.prototype.hasOwnProperty.call(raw, "tableComment");
        const tableCommentFromBody = hasTableCommentField
            ? typeof raw?.tableComment === "string"
                ? raw.tableComment.slice(0, 2000)
                : raw?.tableComment == null
                ? null
                : String(raw.tableComment).slice(0, 2000)
            : undefined;
        const hasPeopleField =
            raw !== undefined && Object.prototype.hasOwnProperty.call(raw, "peopleCount");
        const peopleFromBody = hasPeopleField ? sanitizePeopleCount(raw?.peopleCount) : undefined;

        const cartSnapshot = getCart(tableId);
        const fallbackItems = cartSnapshot.items
            .map((it) =>
                sanitizeItem({
                    name: it.name,
                    qty: it.qty,
                    price: it.price,
                    personId: it.personId,
                })
            )
            .filter((it: { name: string; qty: number }) => it.name && it.qty > 0);

        const maxGuestIndex = Math.max(
            maxGuestIndexFromItems(bodyItems),
            maxGuestIndexFromItems(fallbackItems),
            Number.isFinite(Number(peopleFromBody)) ? Number(peopleFromBody) : 0,
            Number.isFinite(Number(cartSnapshot.peopleCount)) ? Number(cartSnapshot.peopleCount) : 0
        );

        const sanitizedGuestNames = sanitizeGuestNamesRecord(raw?.guestNames, {
            count: maxGuestIndex || undefined,
        });

        const payload = {
            tableComment: hasTableCommentField
                ? tableCommentFromBody ?? null
                : cartSnapshot.tableComment?.slice(0, 2000) ?? null,
            peopleCount:
                peopleFromBody ?? sanitizePeopleCount(cartSnapshot.peopleCount),
            items: bodyItems.length > 0 ? bodyItems : fallbackItems,
            guestNames: sanitizedGuestNames,
            deviceId: typeof raw?.deviceId === "string" ? raw.deviceId.trim() : undefined,
        };

        const parsed = BodySchema.safeParse(payload);
        if (!parsed.success) {
            console.error("submit/validation", parsed.error.flatten());
            const firstIssue =
                parsed.error.issues?.[0]?.message ??
                parsed.error.flatten().formErrors?.[0] ??
                "Requête invalide";
            return NextResponse.json(
                { ok: false, code: "INVALID_JSON_BODY", message: firstIssue, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { items, tableComment, peopleCount, guestNames, deviceId } = parsed.data;

        if (items.length === 0) {
            return NextResponse.json(
                { ok: false, code: "EMPTY_CART", message: "Panier vide" },
                { status: 400 }
            );
        }

        const master = await getTableMaster(tableId);
        if (!master) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "MASTER_REQUIRED",
                    message: "Désignez d'abord le téléphone qui gère la commande pour cette table.",
                },
                { status: 403 }
            );
        }
        if (!isMasterDevice(master, deviceId)) {
            return NextResponse.json(
                {
                    ok: false,
                    code: "NOT_MASTER",
                    message: "Seul le téléphone maître peut envoyer la commande.",
                },
                { status: 403 }
            );
        }

        await touchTableMaster(tableId, deviceId!);

        const total = items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);

        const order = await prisma.order.create({
            data: {
                tableId,
                status: "NEW",
                comment: tableComment ?? null,
                total,
                // 👉 n’ajoute peopleCount QUE s’il existe ET que la colonne existe dans ton schéma
                ...(typeof peopleCount === "number" ? { peopleCount } : {}),
                items: {
                    create: items.map((it) => ({
                        name: it.name,
                        price: it.price ?? null,
                        qty: it.qty,
                        personId: it.personId ?? null,
                    })),
                },
            },
            select: { id: true },
        });

        storeGuestNames(order.id, guestNames);
        clearCart(tableId);

        return NextResponse.json({ ok: true, id: order.id });
    } catch (err: any) {
        console.error("submit/POST error →", err);
        return NextResponse.json(
            { ok: false, code: "SERVER_ERROR", error: String(err?.message ?? err) },
            { status: 500 }
        );
    }
}

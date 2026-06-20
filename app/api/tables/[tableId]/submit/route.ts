import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sanitizeGuestNamesRecord } from "@/lib/guest-name-utils";
import { guestNamesToJson } from "@/lib/guest-names-db";
import { getTableMaster, isMasterDevice, clearTableMaster } from "@/lib/table-master";
import { clearTableDraftCart } from "@/lib/table-draft-cart";
import { occupyTable } from "@/lib/table-occupancy";
import { validateAndResolveOrderItems } from "@/lib/order-items-validation";
import { getSettings } from "@/lib/settings";
import { closedMessage, isRestaurantOpen } from "@/lib/restaurant-open";
import { checkPublicActionAllowed, getClientIp, recordPublicAction } from "@/lib/public-rate-limit";
import { assertValidDineInTableId } from "@/lib/table-id-validation";
import { z } from "zod";

const BodySchema = z.object({
  tableComment: z.string().max(2000).optional().nullable(),
  peopleCount: z.number().int().min(1).max(12).optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        qty: z.number().int().min(1),
        personId: z.string().optional().nullable(),
      })
    )
    .min(1, "Il faut au moins 1 item"),
  guestNames: z.record(z.string()).optional(),
  deviceId: z.string().min(8).optional(),
});

function maxGuestIndexFromItems(items: { personId?: string | null }[]): number {
  return items.reduce((max, item) => {
    if (!item.personId) return max;
    const match = /^P?(\d+)$/i.exec(item.personId);
    if (!match) return max;
    const value = Number(match[1]);
    if (!Number.isInteger(value) || value <= 0) return max;
    return Math.max(max, value);
  }, 0);
}

export async function POST(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const ip = getClientIp(req);
    const retryAfter = checkPublicActionAllowed("order-submit", ip);
    if (retryAfter > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: `Trop de commandes. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const tableId = String(params.tableId).trim();
    const tableCheck = await assertValidDineInTableId(tableId);
    if (tableCheck.ok === false) {
      recordPublicAction("order-submit", ip);
      return NextResponse.json(
        { ok: false, code: "INVALID_TABLE", message: tableCheck.message },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!isRestaurantOpen(settings.openingHours)) {
      return NextResponse.json(
        { ok: false, code: "CLOSED", message: closedMessage() },
        { status: 403 }
      );
    }

    const raw = await req.json().catch(() => undefined);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      recordPublicAction("order-submit", ip);
      const firstIssue =
        parsed.error.issues?.[0]?.message ??
        parsed.error.flatten().formErrors?.[0] ??
        "Requête invalide";
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON_BODY", message: firstIssue },
        { status: 400 }
      );
    }

    const { items: rawItems, tableComment, peopleCount, guestNames, deviceId } = parsed.data;

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

    const resolved = await validateAndResolveOrderItems(
      rawItems.map((it) => ({
        name: String(it.name),
        qty: it.qty,
        personId: it.personId ?? null,
      }))
    );
    if (resolved.ok === false) {
      recordPublicAction("order-submit", ip);
      return NextResponse.json(
        { ok: false, code: resolved.code, message: resolved.message },
        { status: 400 }
      );
    }

    const maxGuestIndex = Math.max(
      maxGuestIndexFromItems(resolved.items),
      typeof peopleCount === "number" ? peopleCount : 0
    );
    const sanitizedGuestNames = sanitizeGuestNamesRecord(guestNames, {
      count: maxGuestIndex || undefined,
    });

    await clearTableMaster(tableId);

    const order = await prisma.order.create({
      data: {
        tableId,
        status: "NEW",
        comment: tableComment?.trim() ? tableComment.trim().slice(0, 2000) : null,
        total: resolved.total,
        ...(typeof peopleCount === "number" ? { peopleCount } : {}),
        guestNames: guestNamesToJson(sanitizedGuestNames),
        items: {
          create: resolved.items.map((it) => ({
            name: it.name,
            price: it.price,
            qty: it.qty,
            personId: it.personId ?? null,
          })),
        },
      },
      select: { id: true },
    });

    await clearTableDraftCart(tableId);
    await occupyTable(tableId, order.id);

    return NextResponse.json({ ok: true, id: order.id, total: resolved.total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("submit/POST error →", message);
    return NextResponse.json(
      { ok: false, code: "SERVER_ERROR", error: message },
      { status: 500 }
    );
  }
}

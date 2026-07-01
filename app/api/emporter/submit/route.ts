import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { expireStalePendingTakeaway, pickAvailableTakeawayCode } from "@/lib/takeaway-codes";
import { validateAndResolveOrderItems } from "@/lib/order-items-validation";
import { getSettings } from "@/lib/settings";
import { closedMessage, isRestaurantOpen } from "@/lib/restaurant-open";
import { checkPublicActionAllowed, getClientIp, recordPublicAction } from "@/lib/public-rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        qty: z.number().int().min(1),
        supplements: z
          .array(z.object({ label: z.string(), priceCents: z.number() }))
          .optional(),
      })
    )
    .min(1, "Il faut au moins 1 article"),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const retryAfter = checkPublicActionAllowed("order-submit", ip);
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    recordPublicAction("order-submit", ip);
    return NextResponse.json({ ok: false, message: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    recordPublicAction("order-submit", ip);
    const firstIssue = parsed.error.issues?.[0]?.message ?? "Requête invalide";
    return NextResponse.json({ ok: false, message: firstIssue }, { status: 400 });
  }

  const settings = await getSettings();
  if (!isRestaurantOpen(settings.openingHours)) {
    return NextResponse.json({ ok: false, message: closedMessage() }, { status: 403 });
  }

  const { items: rawItems, comment } = parsed.data;
  const resolved = await validateAndResolveOrderItems(
    rawItems.map((it) => ({
      name: String(it.name),
      qty: it.qty,
      supplements: it.supplements,
    })),
    { context: "client" }
  );
  if (resolved.ok === false) {
    recordPublicAction("order-submit", ip);
    return NextResponse.json({ ok: false, message: resolved.message }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(728193)`;
      await expireStalePendingTakeaway(tx);
      const code = await pickAvailableTakeawayCode(tx);
      return tx.order.create({
        data: {
          tableId: "EMPORTER",
          type: "TAKEAWAY",
          code,
          status: "PENDING_PAYMENT",
          comment: comment?.trim() ? comment.trim() : null,
          total: resolved.total,
          items: {
            create: resolved.items.map((it) => ({
              name: it.name,
              price: it.price,
              qty: it.qty,
              personId: null,
              supplements: it.supplements.length > 0 ? it.supplements : undefined,
            })),
          },
        },
        select: { id: true, code: true },
      });
    });

    return NextResponse.json({ ok: true, id: order.id, code: order.code, total: resolved.total });
  } catch (err: unknown) {
    recordPublicAction("order-submit", ip);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[emporter/submit]", message);
    return NextResponse.json(
      { ok: false, message: "Erreur lors de la création de la commande" },
      { status: 500 }
    );
  }
}

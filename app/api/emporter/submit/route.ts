import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { expireStalePendingTakeaway, pickAvailableTakeawayCode } from "@/lib/takeaway-codes";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().int().nonnegative().optional(),
        qty: z.number().int().min(1),
      })
    )
    .min(1, "Il faut au moins 1 article"),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues?.[0]?.message ?? "Requête invalide";
    return NextResponse.json({ ok: false, message: firstIssue }, { status: 400 });
  }

  const { items, comment } = parsed.data;
  const total = items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);

  try {
    // Verrou consultatif Postgres : sérialise l'attribution du code à emporter
    // pour éviter que deux validations simultanées reçoivent le même personnage.
    const order = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(728193)`;
      // Libère les codes des commandes jamais validées en caisse (> 1 h)
      await expireStalePendingTakeaway(tx);
      const code = await pickAvailableTakeawayCode(tx);
      return tx.order.create({
        data: {
          tableId: "EMPORTER",
          type: "TAKEAWAY",
          code,
          // En attente de validation par l'hôte de caisse (paiement) avant
          // d'être transmise en cuisine.
          status: "PENDING_PAYMENT",
          comment: comment?.trim() ? comment.trim() : null,
          total,
          items: {
            create: items.map((it) => ({
              name: it.name,
              price: it.price ?? null,
              qty: it.qty,
              personId: null,
            })),
          },
        },
        select: { id: true, code: true },
      });
    });

    return NextResponse.json({ ok: true, id: order.id, code: order.code });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[emporter/submit]", message);
    return NextResponse.json(
      { ok: false, message: "Erreur lors de la création de la commande" },
      { status: 500 }
    );
  }
}

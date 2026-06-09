import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Statuts considérés comme "terminés" : le code peut être recyclé. */
const FINISHED_STATUSES = ["SERVED", "CANCELED"];

/** Délai au-delà duquel une commande non validée en caisse expire (1 h). */
export const PENDING_PAYMENT_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Annule automatiquement les commandes à emporter restées en attente de
 * validation caisse depuis plus d'une heure (fausses commandes, clients
 * partis sans payer). Libère leurs codes manga au passage.
 * Renvoie le nombre de commandes expirées.
 */
export async function expireStalePendingTakeaway(
  client: PrismaLike = prisma
): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_EXPIRATION_MS);
  const res = await client.order.updateMany({
    where: {
      type: "TAKEAWAY",
      status: "PENDING_PAYMENT",
      createdAt: { lt: cutoff },
    },
    data: { status: "CANCELED" },
  });
  return res.count;
}

/** Client Prisma global OU client de transaction. */
type PrismaLike = typeof prisma | Prisma.TransactionClient;

/**
 * Liste de personnages de manga connus, servant de codes lisibles
 * pour différencier les commandes à emporter.
 */
export const TAKEAWAY_CODES: string[] = [
  // Dragon Ball
  "Goku",
  "Vegeta",
  "Gohan",
  "Piccolo",
  "Trunks",
  "Krilin",
  "Freezer",
  "Bulma",
  // One Piece
  "Luffy",
  "Zoro",
  "Nami",
  "Sanji",
  "Chopper",
  "Robin",
  "Franky",
  "Brook",
  "Ace",
  "Shanks",
  // Naruto
  "Naruto",
  "Sasuke",
  "Sakura",
  "Kakashi",
  "Itachi",
  "Gaara",
  "Hinata",
  "Jiraya",
  // Autres mangas connus
  "Ichigo",
  "Light",
  "Eren",
  "Mikasa",
  "Levi",
  "Tanjiro",
  "Nezuko",
  "Zenitsu",
  "Deku",
  "Bakugo",
  "Saitama",
  "Genos",
  "Gon",
  "Killua",
  "Edward",
  "Alphonse",
  "Yusuke",
  "Kenshin",
  "Vash",
  "Spike",
  "Gintoki",
  "Asta",
  "Yuji",
  "Gojo",
  "Megumi",
];

/**
 * Renvoie un code manga actuellement libre (non utilisé par une commande
 * à emporter active). Recyclé dès que la commande est servie/annulée.
 * Si tous les codes sont pris, génère un fallback numéroté.
 */
export async function pickAvailableTakeawayCode(
  client: PrismaLike = prisma
): Promise<string> {
  const activeOrders = await client.order.findMany({
    where: {
      type: "TAKEAWAY",
      status: { notIn: FINISHED_STATUSES },
      code: { not: null },
    },
    select: { code: true },
  });

  const used = new Set(
    activeOrders
      .map((o) => o.code?.trim())
      .filter((c): c is string => Boolean(c))
  );

  for (const code of TAKEAWAY_CODES) {
    if (!used.has(code)) return code;
  }

  // Tous les codes sont pris : fallback numéroté unique
  let suffix = 2;
  for (;;) {
    const candidate = `${TAKEAWAY_CODES[0]} ${suffix}`;
    if (!used.has(candidate)) return candidate;
    suffix += 1;
  }
}

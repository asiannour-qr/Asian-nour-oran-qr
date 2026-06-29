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

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Renvoie un code manga pour une nouvelle commande à emporter en :
 *  1. excluant les codes des commandes actives (jamais deux codes identiques
 *     en cours en même temps) ;
 *  2. évitant les codes utilisés récemment, même déjà servis, pour ne pas
 *     redistribuer « Goku » juste après l'avoir libéré ;
 *  3. tirant au sort dans le pool restant (aléatoire réel et bien réparti).
 *
 * Si tous les codes sont actifs en même temps, génère un fallback numéroté.
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

  const active = new Set(
    activeOrders
      .map((o) => o.code?.trim())
      .filter((c): c is string => Boolean(c))
  );

  // Historique récent (toutes commandes à emporter, servies incluses), du plus
  // récent au plus ancien, sur environ un cycle complet de la liste.
  const recentOrders = await client.order.findMany({
    where: { type: "TAKEAWAY", code: { not: null } },
    orderBy: { createdAt: "desc" },
    take: TAKEAWAY_CODES.length,
    select: { code: true },
  });

  // Rang de dernière utilisation : 0 = tout dernier utilisé (le plus récent).
  const lastUsedRank = new Map<string, number>();
  recentOrders.forEach((o, index) => {
    const code = o.code?.trim();
    if (code && !lastUsedRank.has(code)) lastUsedRank.set(code, index);
  });

  const candidates = TAKEAWAY_CODES.filter((code) => !active.has(code));

  if (candidates.length > 0) {
    // En priorité, les codes jamais utilisés sur la fenêtre récente.
    const fresh = candidates.filter((code) => !lastUsedRank.has(code));
    if (fresh.length > 0) return pickRandom(fresh);

    // Sinon, on prend les moins récemment utilisés (rang le plus élevé) et on
    // tire au sort parmi ceux-là pour garder de l'aléatoire.
    const oldestRank = Math.max(...candidates.map((code) => lastUsedRank.get(code) ?? 0));
    const leastRecent = candidates.filter((code) => (lastUsedRank.get(code) ?? 0) === oldestRank);
    return pickRandom(leastRecent);
  }

  // Tous les codes sont actifs simultanément : fallback numéroté unique.
  let suffix = 2;
  for (;;) {
    const candidate = `${TAKEAWAY_CODES[0]} ${suffix}`;
    if (!active.has(candidate)) return candidate;
    suffix += 1;
  }
}

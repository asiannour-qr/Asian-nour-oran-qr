import { formatMoney } from "@/lib/currency";
import { RESTAURANT_TZ } from "@/lib/restaurant-time";

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = 32; // Xprinter XP-260M 80mm, police A

export type EscPosOrderItem = {
  name: string;
  qty: number;
  price?: number | null;
  personId?: string | null;
  modifiers?: string[] | null;
};

export type EscPosOrderTicketInput = {
  id: string;
  tableId: string;
  total: number;
  comment?: string | null;
  status?: string | null;
  type?: string | null;
  code?: string | null;
  createdAt: Date | string;
  items: EscPosOrderItem[];
  guestNames?: Record<string, string> | null;
};

function isTakeawayOrder(order: { type?: string | null }): boolean {
  return order.type === "TAKEAWAY";
}

export type EscPosRestaurantInfo = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
};

function stripForEscPos(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function textLine(value: string): Buffer {
  return Buffer.from(`${stripForEscPos(value)}\n`, "ascii");
}

/** Ligne avec libellé à gauche et valeur à droite, alignée sur LINE_WIDTH. */
function lineLR(left: string, right: string): Buffer {
  const l = stripForEscPos(left);
  const r = stripForEscPos(right);
  const space = Math.max(1, LINE_WIDTH - l.length - r.length);
  return Buffer.from(`${l}${" ".repeat(space)}${r}\n`, "ascii");
}

function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: RESTAURANT_TZ,
  });
}

function formatTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: RESTAURANT_TZ,
  });
}

function setAlign(align: "left" | "center"): Buffer {
  return Buffer.from([ESC, 0x61, align === "center" ? 1 : 0]);
}

function setBold(enabled: boolean): Buffer {
  return Buffer.from([ESC, 0x45, enabled ? 1 : 0]);
}

/** Taille du texte (multiplicateurs 1..8). */
function setSize(width: number, height: number): Buffer {
  const w = Math.max(1, Math.min(8, width)) - 1;
  const h = Math.max(1, Math.min(8, height)) - 1;
  return Buffer.from([GS, 0x21, (w << 4) | h]);
}

function resetSize(): Buffer {
  return Buffer.from([GS, 0x21, 0x00]);
}

function separator(): Buffer {
  return textLine("-".repeat(LINE_WIDTH));
}

function feed(lines = 1): Buffer {
  return Buffer.from("\n".repeat(Math.max(0, lines)), "ascii");
}

function cutPaper(): Buffer {
  return Buffer.from([GS, 0x56, 0x00]);
}

function groupByPerson(items: EscPosOrderItem[]): Record<string, EscPosOrderItem[]> {
  return items.reduce<Record<string, EscPosOrderItem[]>>((acc, item) => {
    const raw = item.personId?.trim() || "P1";
    acc[raw] = acc[raw] || [];
    acc[raw].push(item);
    return acc;
  }, {});
}

/** Libellé convive pour la cuisine : nom réel ou « Convive N ». */
function kitchenGuestLabel(
  guestNames: Record<string, string> | null | undefined,
  personId: string
): string {
  const match = /^P?(\d+)$/i.exec(personId.trim());
  const index = match ? Number(match[1]) : Number.NaN;
  if (Number.isInteger(index) && index > 0) {
    const custom = guestNames?.[String(index)];
    if (custom && custom.trim()) return custom.trim();
    return `Convive ${index}`;
  }
  return personId;
}

type ConsolidatedItem = { name: string; qty: number; price: number };

/** Regroupe les articles identiques (nom + prix) en sommant les quantités. */
function consolidateItems(items: EscPosOrderItem[]): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem>();
  for (const item of items) {
    const price = Number.isFinite(item.price) ? Number(item.price) : 0;
    const qty = Number.isFinite(item.qty) ? Number(item.qty) : 0;
    const key = `${item.name}|${price}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(key, { name: item.name, qty, price });
    }
  }
  return Array.from(map.values());
}

/**
 * Ticket CUISINE — lecture rapide pour les salariés.
 * Pas de prix : uniquement quantités, articles, et commentaires bien visibles.
 */
export function buildEscPosKitchenTicket(order: EscPosOrderTicketInput): Buffer {
  const chunks: Buffer[] = [];
  const groups = groupByPerson(order.items);

  chunks.push(Buffer.from([ESC, 0x40])); // Init

  // En-tête
  const takeaway = isTakeawayOrder(order);

  chunks.push(setAlign("center"));
  chunks.push(setBold(true));
  chunks.push(setSize(2, 2));
  chunks.push(textLine("CUISINE"));
  chunks.push(resetSize());
  chunks.push(setBold(false));
  chunks.push(setAlign("left"));
  chunks.push(feed(1));

  // Infos essentielles, grandes
  if (takeaway) {
    chunks.push(setAlign("center"));
    chunks.push(setBold(true));
    chunks.push(setSize(2, 2));
    chunks.push(textLine("A EMPORTER"));
    chunks.push(textLine(order.code ?? "-"));
    chunks.push(resetSize());
    chunks.push(setBold(false));
    chunks.push(setAlign("left"));
    chunks.push(textLine(formatTime(order.createdAt)));
  } else {
    chunks.push(setBold(true));
    chunks.push(setSize(1, 2));
    chunks.push(lineLR(`TABLE ${order.tableId}`, formatTime(order.createdAt)));
    chunks.push(resetSize());
    chunks.push(setBold(false));
    chunks.push(textLine(`Cmd ${order.id.slice(0, 8).toUpperCase()}`));
  }

  // Articles groupés par convive
  for (const [personId, items] of Object.entries(groups)) {
    const displayGuest = kitchenGuestLabel(order.guestNames, personId);

    chunks.push(separator());
    chunks.push(setAlign("center"));
    chunks.push(setBold(true));
    chunks.push(textLine(displayGuest.toUpperCase()));
    chunks.push(setBold(false));
    chunks.push(setAlign("left"));
    chunks.push(feed(1));

    for (const item of items) {
      chunks.push(setBold(true));
      chunks.push(setSize(1, 2));
      chunks.push(textLine(`${item.qty} x ${item.name}`));
      chunks.push(resetSize());
      chunks.push(setBold(false));

      const modifiers = Array.isArray(item.modifiers)
        ? item.modifiers.filter((m): m is string => Boolean(m && m.trim()))
        : [];
      for (const mod of modifiers) {
        chunks.push(textLine(`   - ${mod}`));
      }
    }
  }

  // Commentaire mis en avant
  if (order.comment?.trim()) {
    chunks.push(separator());
    chunks.push(setAlign("center"));
    chunks.push(setBold(true));
    chunks.push(textLine("*** NOTE ***"));
    chunks.push(setBold(false));
    chunks.push(setAlign("left"));
    chunks.push(setSize(1, 2));
    chunks.push(textLine(order.comment.trim()));
    chunks.push(resetSize());
  }

  chunks.push(separator());
  chunks.push(feed(3));
  chunks.push(cutPaper());

  return Buffer.concat(chunks);
}

/**
 * Ticket CLIENT — reçu normalisé : infos restaurant, articles, prix, total.
 */
export function buildEscPosCustomerTicket(
  order: EscPosOrderTicketInput,
  info: EscPosRestaurantInfo
): Buffer {
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from([ESC, 0x40])); // Init

  // En-tête restaurant
  chunks.push(setAlign("center"));
  chunks.push(setBold(true));
  chunks.push(setSize(2, 2));
  chunks.push(textLine(info.restaurantName || "ASIAN NOUR"));
  chunks.push(resetSize());
  chunks.push(setBold(false));
  if (info.address?.trim()) {
    chunks.push(textLine(info.address.trim()));
  }
  if (info.phone?.trim()) {
    chunks.push(textLine(`Tel: ${info.phone.trim()}`));
  }
  chunks.push(setAlign("left"));
  chunks.push(separator());

  // Métadonnées commande
  const takeaway = isTakeawayOrder(order);
  if (takeaway) {
    chunks.push(lineLR("A emporter", order.code ?? "-"));
  } else {
    chunks.push(lineLR("Table", order.tableId));
    chunks.push(lineLR("Commande", order.id.slice(0, 8).toUpperCase()));
  }
  chunks.push(lineLR("Date", formatDate(order.createdAt)));
  chunks.push(lineLR("Heure", formatTime(order.createdAt)));
  chunks.push(separator());

  // Articles consolidés + prix (reçu client, sans découpage convive)
  for (const item of consolidateItems(order.items)) {
    chunks.push(lineLR(`${item.qty} x ${item.name}`, formatMoney(item.price * item.qty)));
  }

  // Total
  chunks.push(separator());
  chunks.push(setBold(true));
  chunks.push(setSize(1, 2));
  chunks.push(lineLR("TOTAL", formatMoney(order.total)));
  chunks.push(resetSize());
  chunks.push(setBold(false));

  // Note éventuelle
  if (order.comment?.trim()) {
    chunks.push(separator());
    chunks.push(textLine("Note:"));
    chunks.push(textLine(order.comment.trim()));
  }

  // Consigne caisse pour les commandes à emporter
  if (takeaway) {
    chunks.push(separator());
    chunks.push(setAlign("center"));
    chunks.push(setBold(true));
    chunks.push(textLine("Presentez ce code a la caisse"));
    chunks.push(setBold(false));
    chunks.push(textLine("pour valider apres paiement."));
    chunks.push(setAlign("left"));
  }

  chunks.push(separator());
  chunks.push(setAlign("center"));
  chunks.push(textLine("Merci pour votre visite !"));
  chunks.push(setAlign("left"));
  chunks.push(feed(3));
  chunks.push(cutPaper());

  return Buffer.concat(chunks);
}

/** Ticket de test ESC/POS pour Xprinter XP-260M (80 mm). */
export function buildEscPosTestTicket(): Buffer {
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from([ESC, 0x40])); // Init
  chunks.push(setAlign("center"));
  chunks.push(textLine("=== TEST IMPRESSION ==="));
  chunks.push(textLine("Asian Nour"));
  chunks.push(setAlign("left"));
  chunks.push(feed(1));
  chunks.push(textLine(`Date: ${new Date().toLocaleString("fr-FR", { timeZone: RESTAURANT_TZ })}`));
  chunks.push(textLine("Imprimante ESC/POS OK"));
  chunks.push(feed(2));
  chunks.push(cutPaper());

  return Buffer.concat(chunks);
}

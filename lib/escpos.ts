import { formatMoney } from "@/lib/currency";
import { isComposedMenuCartLabel } from "@/lib/kitchen-item-label";
import { getEscPosLineWidth } from "@/lib/printer-profile";
import { RESTAURANT_TZ } from "@/lib/restaurant-time";

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = getEscPosLineWidth();

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

/** ASCII imprimable — tirets / puces unicode convertis avant filtrage. */
function sanitizeForPrinter(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[""«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[•·▪►→]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\x20-\x7E]/g, "");
}

function stripForEscPos(value: string): string {
  return sanitizeForPrinter(value);
}

function wrapText(text: string, maxWidth: number): string[] {
  const cleaned = stripForEscPos(text).trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxWidth) return [cleaned];

  const words = cleaned.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxWidth) {
      current = word;
    } else {
      let rest = word;
      while (rest.length > maxWidth) {
        lines.push(rest.slice(0, maxWidth));
        rest = rest.slice(maxWidth);
      }
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function appendLines(chunks: Buffer[], lines: string[]): void {
  for (const line of lines) {
    chunks.push(textLine(line));
  }
}

/** Menus composés admin : « Asian Classic — Entrée: … • Plat: … » */
function parseComposedMenuName(rawName: string): { title: string; details: string[] } {
  const trimmed = rawName.trim();
  const dashParts = trimmed.split(/\s+[—–]\s+/);
  if (dashParts.length < 2) {
    return { title: sanitizeForPrinter(trimmed), details: [] };
  }

  const title = sanitizeForPrinter(dashParts[0].trim());
  const detailsBlob = dashParts.slice(1).join(" - ");
  const details = detailsBlob
    .split(/\s*[•·]\s*/)
    .map((part) => sanitizeForPrinter(part.trim()))
    .filter(Boolean);

  return { title, details };
}

/**
 * Article cuisine — Xprinter XP-260M : pas de gras ESC E sur les lignes articles.
 */
function appendKitchenItem(chunks: Buffer[], item: EscPosOrderItem): void {
  const modifiers = Array.isArray(item.modifiers)
    ? item.modifiers.map((m) => sanitizeForPrinter(String(m))).filter(Boolean)
    : [];

  let title = sanitizeForPrinter(item.name);
  let composedDetails: string[] = [];
  if (isComposedMenuCartLabel(item.name)) {
    const parsed = parseComposedMenuName(item.name);
    title = parsed.title;
    composedDetails = parsed.details;
  }

  const details = [...composedDetails, ...modifiers];

  const qty = Number.isFinite(item.qty) ? Math.max(1, item.qty) : 1;
  const headline = `${qty} x ${title.toUpperCase()}`;

  appendStyledBlock(chunks, wrapText(headline, LINE_WIDTH), {
    bold: false,
    width: 1,
    height: 1,
  });

  for (const detail of details) {
    const detailLines = wrapText(detail, LINE_WIDTH - 2);
    detailLines.forEach((line, index) => {
      const text = index === 0 ? `> ${line}` : `  ${line}`;
      appendStyledBlock(chunks, [text], { bold: false, width: 1, height: 1 });
    });
  }

  chunks.push(feed(1));
}

function textLine(value: string): Buffer {
  return Buffer.from(`${stripForEscPos(value)}\n`, "ascii");
}

/** Ligne avec libellé à gauche et valeur à droite, alignée sur LINE_WIDTH. */
function lineLR(left: string, right: string): Buffer {
  return Buffer.from(`${lineLRText(left, right)}\n`, "ascii");
}

function lineLRText(left: string, right: string, maxWidth = LINE_WIDTH): string {
  const l = stripForEscPos(left);
  const r = stripForEscPos(right);
  const space = Math.max(1, maxWidth - l.length - r.length);
  return `${l}${" ".repeat(space)}${r}`;
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

/** Réinitialise taille, gras et attributs ESC ! (fiabilité Xprinter). */
function resetStyle(): Buffer {
  return Buffer.concat([
    Buffer.from([GS, 0x21, 0x00]),
    Buffer.from([ESC, 0x45, 0x00]),
    Buffer.from([ESC, 0x21, 0x00]),
  ]);
}

function effectiveWidth(sizeMultiplier: number): number {
  return Math.max(12, Math.floor(LINE_WIDTH / Math.max(1, sizeMultiplier)));
}

function appendStyledBlock(
  chunks: Buffer[],
  lines: string[],
  options: { bold?: boolean; width?: number; height?: number; align?: "left" | "center" }
): void {
  if (!lines.length) return;
  if (options.align === "center") chunks.push(setAlign("center"));
  chunks.push(setBold(options.bold === true));
  chunks.push(setSize(options.width ?? 1, options.height ?? 1));
  appendLines(chunks, lines);
  chunks.push(resetStyle());
  if (options.align === "center") chunks.push(setAlign("left"));
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
  chunks.push(resetStyle());

  // En-tête
  const takeaway = isTakeawayOrder(order);

  appendStyledBlock(chunks, ["CUISINE"], {
    bold: true,
    width: 2,
    height: 2,
    align: "center",
  });
  chunks.push(feed(1));

  // Infos essentielles
  if (takeaway) {
    appendStyledBlock(chunks, ["A EMPORTER"], {
      bold: true,
      width: 2,
      height: 2,
      align: "center",
    });
    appendStyledBlock(chunks, [order.code ?? "-"], {
      bold: true,
      width: 2,
      height: 2,
      align: "center",
    });
    appendStyledBlock(chunks, [formatTime(order.createdAt)], {
      bold: true,
      width: 1,
      height: 2,
    });
  } else {
    chunks.push(resetStyle());
    chunks.push(setBold(true));
    chunks.push(lineLR(`TABLE ${order.tableId}`, formatTime(order.createdAt)));
    chunks.push(resetStyle());
    appendStyledBlock(chunks, [`CMD ${order.id.slice(0, 8).toUpperCase()}`], {
      bold: true,
      width: 1,
      height: 2,
    });
  }

  // Articles groupés par convive
  for (const [personId, items] of Object.entries(groups)) {
    const displayGuest = kitchenGuestLabel(order.guestNames, personId);

    chunks.push(separator());
    appendStyledBlock(chunks, [displayGuest.toUpperCase()], {
      bold: true,
      width: 1,
      height: 2,
      align: "center",
    });
    chunks.push(feed(1));

    for (const item of items) {
      appendKitchenItem(chunks, item);
    }
  }

  // Commentaire mis en avant
  if (order.comment?.trim()) {
    chunks.push(separator());
    appendStyledBlock(chunks, ["*** NOTE ***"], {
      bold: true,
      width: 2,
      height: 2,
      align: "center",
    });
    chunks.push(feed(1));
    appendStyledBlock(chunks, wrapText(order.comment.trim(), effectiveWidth(2)), {
      bold: true,
      width: 2,
      height: 2,
    });
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
  chunks.push(resetStyle());

  // En-tête restaurant
  appendStyledBlock(chunks, [info.restaurantName || "ASIAN NOUR"], {
    bold: true,
    width: 2,
    height: 2,
    align: "center",
  });
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
    const label = `${item.qty} x ${stripForEscPos(item.name)}`;
    const price = formatMoney(item.price * item.qty);
    if (label.length + price.length + 1 <= LINE_WIDTH) {
      chunks.push(lineLR(label, price));
    } else {
      for (const line of wrapText(label, LINE_WIDTH)) {
        chunks.push(textLine(line));
      }
      chunks.push(lineLR("", price));
    }
  }

  // Total
  chunks.push(separator());
  appendStyledBlock(chunks, [lineLRText("TOTAL", formatMoney(order.total), effectiveWidth(2))], {
    bold: true,
    width: 2,
    height: 2,
  });

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

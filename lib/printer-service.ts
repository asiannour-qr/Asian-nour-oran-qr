import prisma from "@/lib/prisma";
import {
  buildEscPosCustomerTicket,
  buildEscPosKitchenTicket,
  buildEscPosTestTicket,
  type EscPosOrderTicketInput,
} from "@/lib/escpos";
import { resolveOrderGuestNames } from "@/lib/guest-names-db";
import { enrichItemsForKitchenTicket } from "@/lib/kitchen-item-label";
import { loadOrderCatalog } from "@/lib/order-items-validation";
import {
  CUSTOMER_PRINTER_ID,
  EXTRA_PRINTER_ID,
  KITCHEN_PRINTER_ID,
  LEGACY_PRINTER_ID,
  printerIdForTarget,
  targetForVariant,
  type PrinterTarget,
} from "@/lib/printer-config";
import { sendEscPosToPrinter } from "@/lib/printer-tcp";
import { getSettings } from "@/lib/settings";
import { sanitizeStaffSupplements, supplementsTotalCents } from "@/lib/supplements";
import { getTableOccupancy, ordersCreatedSinceOccupancy } from "@/lib/table-occupancy";
import { KITCHEN_OPEN_STATUSES } from "@/lib/serveur-table-orders";

export type TicketVariant = "kitchen" | "customer";

type CustomerTicketOrderItem = {
  name: string;
  qty: number;
  price?: number | null;
  personId?: string | null;
  supplements?: unknown;
};

/** Transforme les lignes d'une commande en lignes de reçu client (prix suppléments inclus). */
function toCustomerTicketItems(items: CustomerTicketOrderItem[]) {
  return items.map((item) => {
    const supp = sanitizeStaffSupplements(item.supplements);
    const suppTotal = supplementsTotalCents(supp);
    const name =
      supp.length > 0
        ? `${item.name} (+ ${supp.map((s) => s.label).join(", ")})`
        : item.name;
    return {
      name,
      qty: item.qty,
      price: (item.price ?? 0) + suppTotal,
      personId: item.personId,
    };
  });
}

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Mode agent : les tickets sont mis en file d'attente (PrintJob) avec une cible
 * (kitchen | customer) et l'agent local les envoie à la bonne imprimante.
 */
export function isAgentMode(): boolean {
  return Boolean(process.env.PRINT_AGENT_TOKEN);
}

async function loadPrinterConfig(target: PrinterTarget) {
  const id = printerIdForTarget(target);
  let config = await prisma.printerConfig.findUnique({ where: { id } });
  if (!config && target === "kitchen") {
    config = await prisma.printerConfig.findUnique({ where: { id: LEGACY_PRINTER_ID } });
  }
  return config;
}

function printerNotConfiguredMessage(target: PrinterTarget): string {
  if (target === "customer") return "Imprimante caisse non configurée";
  if (target === "extra") return "Imprimante supplémentaire non configurée";
  return "Imprimante cuisine non configurée";
}

async function getPrinterConnection(target: PrinterTarget) {
  const config = await loadPrinterConfig(target);
  if (!config) {
    throw new Error(printerNotConfiguredMessage(target));
  }
  return config;
}

async function hasRecentPrintJob(orderId: string, target: PrinterTarget): Promise<boolean> {
  const existing = await prisma.printJob.findFirst({
    where: {
      orderId,
      target,
      status: { in: ["PENDING", "PROCESSING", "DONE"] },
      createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function deliverPayload(
  payload: Buffer,
  label: string,
  target: PrinterTarget,
  options?: { orderId?: string; force?: boolean }
): Promise<void> {

  if (options?.orderId && !options.force) {
    if (await hasRecentPrintJob(options.orderId, target)) {
      return;
    }
  }

  if (isAgentMode()) {
    await prisma.printJob.create({
      data: {
        label,
        payload: payload.toString("base64"),
        target,
        orderId: options?.orderId ?? null,
      },
    });
    return;
  }
  const config = await getPrinterConnection(target);
  await sendEscPosToPrinter(config.ip, config.port, payload);
}

export async function isPrinterConfigured(variant: TicketVariant = "kitchen"): Promise<boolean> {
  const config = await loadPrinterConfig(targetForVariant(variant));
  return Boolean(config);
}

export async function getPrintersStatus(): Promise<{
  kitchen: boolean;
  customer: boolean;
  extra: boolean;
}> {
  const [kitchen, customer, extra] = await Promise.all([
    loadPrinterConfig("kitchen"),
    loadPrinterConfig("customer"),
    loadPrinterConfig("extra"),
  ]);
  return {
    kitchen: Boolean(kitchen),
    customer: Boolean(customer),
    extra: Boolean(extra),
  };
}

export async function printTestTicketToConfiguredPrinter(
  target: PrinterTarget = "kitchen"
): Promise<{ ip: string; port: number; target: PrinterTarget }> {
  const config = await getPrinterConnection(target);
  const payload = buildEscPosTestTicket();
  const label =
    target === "customer"
      ? "Test imprimante caisse"
      : target === "extra"
        ? "Test imprimante supplementaire"
        : "Test imprimante cuisine";
  await deliverPayload(payload, label, target);
  return { ip: config.ip, port: config.port, target };
}

/**
 * Ticket CLIENT cumulé pour une table : additionne toutes les commandes de la
 * session d'occupation en cours (depuis l'occupation, ou à défaut les tickets
 * encore ouverts) en un seul reçu. Utilisé sur place (QR + serveur confondus).
 */
export async function printTableCustomerTicketToConfiguredPrinter(
  tableId: string,
  options?: { force?: boolean }
): Promise<void> {
  await getPrinterConnection(targetForVariant("customer"));

  const occupancy = await getTableOccupancy(tableId);
  const orders = await prisma.order.findMany({
    where: {
      tableId,
      type: { not: "TAKEAWAY" },
      ...(occupancy
        ? {
            status: { not: "CANCELED" },
            createdAt: { gte: ordersCreatedSinceOccupancy(occupancy.occupiedAt) },
          }
        : { status: { in: [...KITCHEN_OPEN_STATUSES] } }),
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    throw new Error("Aucune commande à imprimer pour cette table");
  }

  const items = orders.flatMap((o) => toCustomerTicketItems(o.items));
  const total = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const comments = Array.from(
    new Set(orders.map((o) => o.comment?.trim()).filter((c): c is string => Boolean(c)))
  );

  const ticketInput: EscPosOrderTicketInput = {
    id: orders[orders.length - 1].id,
    tableId,
    total,
    comment: comments.length > 0 ? comments.join(" / ") : null,
    status: "SERVED",
    type: "DINE_IN",
    code: null,
    createdAt: occupancy?.occupiedAt ?? orders[0].createdAt,
    items,
    guestNames: null,
  };

  const settings = await getSettings();
  const payload = buildEscPosCustomerTicket(ticketInput, {
    restaurantName: settings.restaurantName,
    address: settings.address,
    phone: settings.phone,
  });

  const label = `Ticket client — Table ${tableId}`;
  // force: le reçu évolue à chaque ajout d'article → jamais de déduplication.
  await deliverPayload(payload, label, targetForVariant("customer"), { force: true });
}

export async function printOrderTicketToConfiguredPrinter(
  orderId: string,
  variant: TicketVariant = "kitchen",
  options?: { force?: boolean }
): Promise<void> {
  await getPrinterConnection(targetForVariant(variant));

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new Error("Commande introuvable");
  }

  // Reçu client sur place : on imprime la note cumulée de toute la table,
  // pas seulement la commande ciblée (une seule note jusqu'à libération).
  if (variant === "customer" && order.type !== "TAKEAWAY") {
    await printTableCustomerTicketToConfiguredPrinter(order.tableId, options);
    return;
  }

  const catalog = await loadOrderCatalog();
  const ticketItems =
    variant === "kitchen"
      ? enrichItemsForKitchenTicket(
          order.items.map((item) => {
            const supp = sanitizeStaffSupplements(item.supplements);
            return {
              name: item.name,
              qty: item.qty,
              price: item.price,
              personId: item.personId,
              modifiers: supp.length > 0 ? supp.map((s) => s.label) : undefined,
            };
          }),
          catalog
        )
      : order.items.map((item) => {
          const supp = sanitizeStaffSupplements(item.supplements);
          const suppTotal = supplementsTotalCents(supp);
          const name =
            supp.length > 0
              ? `${item.name} (+ ${supp.map((s) => s.label).join(", ")})`
              : item.name;
          return {
            name,
            qty: item.qty,
            price: (item.price ?? 0) + suppTotal,
            personId: item.personId,
          };
        });

  const ticketInput: EscPosOrderTicketInput = {
    id: order.id,
    tableId: order.tableId,
    total: order.total,
    comment: order.comment,
    status: order.status,
    type: order.type,
    code: order.code,
    createdAt: order.createdAt,
    items: ticketItems,
    guestNames: resolveOrderGuestNames(order),
  };

  let payload: Buffer;
  if (variant === "customer") {
    const settings = await getSettings();
    payload = buildEscPosCustomerTicket(ticketInput, {
      restaurantName: settings.restaurantName,
      address: settings.address,
      phone: settings.phone,
    });
  } else {
    payload = buildEscPosKitchenTicket(ticketInput);
  }

  const where =
    order.type === "TAKEAWAY" ? `Emporter ${order.code ?? ""}` : `Table ${order.tableId}`;
  const label = `${variant === "customer" ? "Ticket client" : "Cuisine"} — ${where.trim()}`;
  await deliverPayload(payload, label, targetForVariant(variant), {
    orderId,
    force: options?.force,
  });
}

/** IDs utilisés par l'admin et l'agent d'impression */
export {
  KITCHEN_PRINTER_ID,
  CUSTOMER_PRINTER_ID,
  EXTRA_PRINTER_ID,
  LEGACY_PRINTER_ID,
};

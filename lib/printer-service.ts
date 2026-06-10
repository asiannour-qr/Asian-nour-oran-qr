import prisma from "@/lib/prisma";
import {
  buildEscPosCustomerTicket,
  buildEscPosKitchenTicket,
  buildEscPosTestTicket,
  type EscPosOrderTicketInput,
} from "@/lib/escpos";
import { getGuestNames } from "@/lib/guest-names-store";
import {
  CUSTOMER_PRINTER_ID,
  KITCHEN_PRINTER_ID,
  LEGACY_PRINTER_ID,
  printerIdForTarget,
  targetForVariant,
  type PrinterTarget,
} from "@/lib/printer-config";
import { sendEscPosToPrinter } from "@/lib/printer-tcp";
import { getSettings } from "@/lib/settings";

export type TicketVariant = "kitchen" | "customer";

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

async function getPrinterConnection(variant: TicketVariant = "kitchen") {
  const target = targetForVariant(variant);
  const config = await loadPrinterConfig(target);
  if (!config) {
    throw new Error(
      variant === "customer"
        ? "Imprimante caisse non configurée"
        : "Imprimante cuisine non configurée"
    );
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
  variant: TicketVariant,
  options?: { orderId?: string; force?: boolean }
): Promise<void> {
  const target = targetForVariant(variant);

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
  const config = await getPrinterConnection(variant);
  await sendEscPosToPrinter(config.ip, config.port, payload);
}

export async function isPrinterConfigured(variant: TicketVariant = "kitchen"): Promise<boolean> {
  const config = await loadPrinterConfig(targetForVariant(variant));
  return Boolean(config);
}

export async function getPrintersStatus(): Promise<{
  kitchen: boolean;
  customer: boolean;
}> {
  const [kitchen, customer] = await Promise.all([
    loadPrinterConfig("kitchen"),
    loadPrinterConfig("customer"),
  ]);
  return { kitchen: Boolean(kitchen), customer: Boolean(customer) };
}

export async function printTestTicketToConfiguredPrinter(
  variant: TicketVariant = "kitchen"
): Promise<{ ip: string; port: number; variant: TicketVariant }> {
  const config = await getPrinterConnection(variant);
  const payload = buildEscPosTestTicket();
  const label =
    variant === "customer" ? "Test imprimante caisse" : "Test imprimante cuisine";
  await deliverPayload(payload, label, variant);
  return { ip: config.ip, port: config.port, variant };
}

export async function printOrderTicketToConfiguredPrinter(
  orderId: string,
  variant: TicketVariant = "kitchen",
  options?: { force?: boolean }
): Promise<void> {
  await getPrinterConnection(variant);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new Error("Commande introuvable");
  }

  const ticketInput: EscPosOrderTicketInput = {
    id: order.id,
    tableId: order.tableId,
    total: order.total,
    comment: order.comment,
    status: order.status,
    type: order.type,
    code: order.code,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      personId: item.personId,
    })),
    guestNames: getGuestNames(order.id),
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
  await deliverPayload(payload, label, variant, { orderId, force: options?.force });
}

/** IDs utilisés par l'admin et l'agent d'impression */
export { KITCHEN_PRINTER_ID, CUSTOMER_PRINTER_ID, LEGACY_PRINTER_ID };

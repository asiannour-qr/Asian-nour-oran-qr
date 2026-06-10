import prisma from "@/lib/prisma";
import {
  buildEscPosCustomerTicket,
  buildEscPosKitchenTicket,
  buildEscPosTestTicket,
  type EscPosOrderTicketInput,
} from "@/lib/escpos";
import { getGuestNames } from "@/lib/guest-names-store";
import { PRINTER_CONFIG_ID } from "@/lib/printer-config";
import { sendEscPosToPrinter } from "@/lib/printer-tcp";
import { getSettings } from "@/lib/settings";

export type TicketVariant = "kitchen" | "customer";

/**
 * Mode "agent" : l'app (hébergée sur Vercel) ne peut pas joindre l'imprimante
 * sur le réseau local du restaurant. Les tickets sont mis en file d'attente
 * (PrintJob) et un agent sur place (scripts/print-agent.mjs) les récupère
 * puis les envoie à l'imprimante en TCP 9100.
 * Le mode agent s'active dès que PRINT_AGENT_TOKEN est défini.
 */
export function isAgentMode(): boolean {
  return Boolean(process.env.PRINT_AGENT_TOKEN);
}

async function deliverPayload(payload: Buffer, label: string): Promise<void> {
  if (isAgentMode()) {
    await prisma.printJob.create({
      data: { label, payload: payload.toString("base64") },
    });
    return;
  }
  const config = await getPrinterConnection();
  await sendEscPosToPrinter(config.ip, config.port, payload);
}

export async function isPrinterConfigured(): Promise<boolean> {
  const config = await prisma.printerConfig.findUnique({
    where: { id: PRINTER_CONFIG_ID },
    select: { id: true },
  });
  return Boolean(config);
}

async function getPrinterConnection() {
  const config = await prisma.printerConfig.findUnique({
    where: { id: PRINTER_CONFIG_ID },
  });
  if (!config) {
    throw new Error("Aucune imprimante configurée");
  }
  return config;
}

export async function printTestTicketToConfiguredPrinter(): Promise<{ ip: string; port: number }> {
  const config = await getPrinterConnection();
  const payload = buildEscPosTestTicket();
  await deliverPayload(payload, "Ticket de test");
  return { ip: config.ip, port: config.port };
}

export async function printOrderTicketToConfiguredPrinter(
  orderId: string,
  variant: TicketVariant = "kitchen"
): Promise<void> {
  // Vérifie que l'imprimante est configurée (l'agent récupère l'IP côté API)
  await getPrinterConnection();
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

  const where = order.type === "TAKEAWAY" ? `Emporter ${order.code ?? ""}` : `Table ${order.tableId}`;
  const label = `${variant === "customer" ? "Ticket client" : "Cuisine"} — ${where.trim()}`;
  await deliverPayload(payload, label);
}

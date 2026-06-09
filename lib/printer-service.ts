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
  await sendEscPosToPrinter(config.ip, config.port, payload);
  return { ip: config.ip, port: config.port };
}

export async function printOrderTicketToConfiguredPrinter(
  orderId: string,
  variant: TicketVariant = "kitchen"
): Promise<void> {
  const config = await getPrinterConnection();
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

  await sendEscPosToPrinter(config.ip, config.port, payload);
}

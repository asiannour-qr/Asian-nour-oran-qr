import prisma from "@/lib/prisma";

/** Marge entre createdAt de la 1re commande et occupiedAt (ms). */
export const OCCUPANCY_ORDER_TIME_TOLERANCE_MS = 5000;

export type TableOccupancyRecord = {
  tableId: string;
  occupiedAt: Date;
  lastOrderId: string | null;
};

/** Date seuil pour inclure les commandes d'une session (1re commande incluse). */
export function ordersCreatedSinceOccupancy(occupiedAt: Date): Date {
  return new Date(occupiedAt.getTime() - OCCUPANCY_ORDER_TIME_TOLERANCE_MS);
}

export async function getTableOccupancy(tableId: string): Promise<TableOccupancyRecord | null> {
  return prisma.tableOccupancy.findUnique({ where: { tableId } });
}

export async function listOccupiedTables(): Promise<TableOccupancyRecord[]> {
  return prisma.tableOccupancy.findMany({ orderBy: { occupiedAt: "asc" } });
}

export async function occupyTable(tableId: string, lastOrderId?: string): Promise<TableOccupancyRecord> {
  const existing = await prisma.tableOccupancy.findUnique({ where: { tableId } });
  if (existing) {
    return prisma.tableOccupancy.update({
      where: { tableId },
      data: { ...(lastOrderId ? { lastOrderId } : {}) },
    });
  }

  let occupiedAt = new Date();
  if (lastOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: lastOrderId },
      select: { createdAt: true },
    });
    if (order) occupiedAt = order.createdAt;
  }

  return prisma.tableOccupancy.create({
    data: { tableId, lastOrderId: lastOrderId ?? null, occupiedAt },
  });
}

export async function releaseTable(tableId: string): Promise<boolean> {
  try {
    await prisma.tableOccupancy.delete({ where: { tableId } });
    return true;
  } catch {
    return false;
  }
}

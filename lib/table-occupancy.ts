import prisma from "@/lib/prisma";

export type TableOccupancyRecord = {
  tableId: string;
  occupiedAt: Date;
  lastOrderId: string | null;
};

export async function getTableOccupancy(tableId: string): Promise<TableOccupancyRecord | null> {
  return prisma.tableOccupancy.findUnique({ where: { tableId } });
}

export async function listOccupiedTables(): Promise<TableOccupancyRecord[]> {
  return prisma.tableOccupancy.findMany({ orderBy: { occupiedAt: "asc" } });
}

export async function occupyTable(tableId: string, lastOrderId?: string): Promise<TableOccupancyRecord> {
  return prisma.tableOccupancy.upsert({
    where: { tableId },
    create: { tableId, lastOrderId: lastOrderId ?? null },
    update: { occupiedAt: new Date(), ...(lastOrderId ? { lastOrderId } : {}) },
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

import prisma from "@/lib/prisma";
import { KITCHEN_OPEN_STATUSES } from "@/lib/serveur-table-orders";

/** Clôture les tickets sur place encore ouverts (NEW / IN_PROGRESS / READY). */
export async function closeOpenDineInOrdersForTable(tableId: string): Promise<number> {
  const result = await prisma.order.updateMany({
    where: {
      tableId,
      type: { not: "TAKEAWAY" },
      status: { in: [...KITCHEN_OPEN_STATUSES] },
    },
    data: { status: "SERVED" },
  });
  return result.count;
}

import { ordersCreatedSinceOccupancy } from "@/lib/table-occupancy";

export type ServeurOrderLite = {
  id: string;
  tableId: string;
  status: string;
  type?: string | null;
  total?: number | null;
  createdAt?: string;
  items?: { id: string; name: string; qty: number }[];
};

const OPEN_STATUSES = new Set(["NEW", "IN_PROGRESS", "READY"]);
export const KITCHEN_OPEN_STATUSES = OPEN_STATUSES;
export const MAX_TABLE_TICKETS = 3;

/** Commande encore active en cuisine (non servie / non annulée). */
export function tableHasOpenKitchenOrders(
  allOrders: ServeurOrderLite[],
  tableId: string
): boolean {
  return allOrders.some(
    (o) =>
      o.tableId === tableId &&
      o.type !== "TAKEAWAY" &&
      o.tableId !== "EMPORTER" &&
      OPEN_STATUSES.has(o.status)
  );
}

type OccupancyMeta = {
  occupiedAt: string;
  lastOrderId?: string | null;
};

/** Commandes pertinentes pour le panneau serveur d'une table. */
export function filterRelevantTableOrders(
  allOrders: ServeurOrderLite[],
  tableId: string,
  options: { isOccupied: boolean; occupancy?: OccupancyMeta | null }
): ServeurOrderLite[] {
  const dineIn = allOrders
    .filter(
      (o) =>
        o.tableId === tableId &&
        o.type !== "TAKEAWAY" &&
        o.tableId !== "EMPORTER" &&
        o.status !== "CANCELED"
    )
    .sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

  let relevant: ServeurOrderLite[];
  if (options.isOccupied && options.occupancy?.occupiedAt) {
    const since = ordersCreatedSinceOccupancy(new Date(options.occupancy.occupiedAt)).getTime();
    relevant = dineIn.filter((o) => new Date(o.createdAt ?? 0).getTime() >= since);
  } else {
    relevant = dineIn.filter((o) => OPEN_STATUSES.has(o.status));
  }

  return relevant.slice(0, MAX_TABLE_TICKETS);
}

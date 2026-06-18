import prisma from "@/lib/prisma";

export type DraftCartItem = {
  id: string;
  name: string;
  priceCents: number;
  qty: number;
  personId: string;
};

export type TableDraftCartRecord = {
  tableId: string;
  items: DraftCartItem[];
  peopleCount: number;
  tableComment: string | null;
  guestNames: Record<string, string>;
  updatedAt: Date;
};

function sanitizeItems(raw: unknown): DraftCartItem[] {
  if (!Array.isArray(raw)) return [];
  const items: DraftCartItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const id = String(row.id ?? "").trim();
    const qty = Number(row.qty);
    const priceCents = Number(row.priceCents ?? row.price ?? 0);
    const personId = String(row.personId ?? "P1").trim() || "P1";
    if (!name || !id || !Number.isFinite(qty) || qty <= 0) continue;
    items.push({
      id,
      name,
      priceCents: Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0,
      qty: Math.round(qty),
      personId,
    });
  }
  return items;
}

function sanitizeGuestNames(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = String(value ?? "").trim();
    if (name) out[key] = name.slice(0, 16);
  }
  return out;
}

export async function getTableDraftCart(tableId: string): Promise<TableDraftCartRecord | null> {
  const row = await prisma.tableDraftCart.findUnique({ where: { tableId } });
  if (!row) return null;
  return {
    tableId: row.tableId,
    items: sanitizeItems(row.items),
    peopleCount: Math.max(1, Math.min(12, row.peopleCount || 1)),
    tableComment: row.tableComment?.slice(0, 2000) ?? null,
    guestNames: sanitizeGuestNames(row.guestNames),
    updatedAt: row.updatedAt,
  };
}

export async function saveTableDraftCart(
  tableId: string,
  payload: {
    items: DraftCartItem[];
    peopleCount?: number;
    tableComment?: string | null;
    guestNames?: Record<string, string>;
  }
): Promise<TableDraftCartRecord> {
  const peopleCount = Math.max(1, Math.min(12, Math.round(payload.peopleCount ?? 1)));
  const items = sanitizeItems(payload.items);
  const tableComment =
    payload.tableComment == null ? null : String(payload.tableComment).slice(0, 2000) || null;
  const guestNames = sanitizeGuestNames(payload.guestNames);

  const row = await prisma.tableDraftCart.upsert({
    where: { tableId },
    create: {
      tableId,
      items,
      peopleCount,
      tableComment,
      guestNames: Object.keys(guestNames).length > 0 ? guestNames : undefined,
    },
    update: {
      items,
      peopleCount,
      tableComment,
      guestNames: Object.keys(guestNames).length > 0 ? guestNames : null,
    },
  });

  return {
    tableId: row.tableId,
    items: sanitizeItems(row.items),
    peopleCount: row.peopleCount,
    tableComment: row.tableComment,
    guestNames: sanitizeGuestNames(row.guestNames),
    updatedAt: row.updatedAt,
  };
}

export async function clearTableDraftCart(tableId: string): Promise<void> {
  await prisma.tableDraftCart.delete({ where: { tableId } }).catch(() => {});
}

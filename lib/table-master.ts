import prisma from "@/lib/prisma";

export const TABLE_MASTER_TTL_MS = 4 * 60 * 60 * 1000;

export type TableMasterRecord = {
  tableId: string;
  deviceId: string;
  claimedAt: Date;
  expiresAt: Date;
};

export async function getTableMaster(tableId: string): Promise<TableMasterRecord | null> {
  const row = await prisma.tableOrderMaster.findUnique({ where: { tableId } });
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await prisma.tableOrderMaster.delete({ where: { tableId } }).catch(() => {});
    return null;
  }
  return row;
}

export async function claimTableMaster(
  tableId: string,
  deviceId: string
): Promise<{ ok: true; record: TableMasterRecord } | { ok: false; code: "TAKEN" }> {
  const existing = await getTableMaster(tableId);
  if (existing && existing.deviceId !== deviceId) {
    return { ok: false, code: "TAKEN" };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TABLE_MASTER_TTL_MS);
  const record = await prisma.tableOrderMaster.upsert({
    where: { tableId },
    create: { tableId, deviceId, claimedAt: now, expiresAt },
    update: { deviceId, claimedAt: now, expiresAt },
  });

  return { ok: true, record };
}

export async function releaseTableMaster(tableId: string, deviceId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || existing.deviceId !== deviceId) return false;
  await prisma.tableOrderMaster.delete({ where: { tableId } });
  return true;
}

export async function touchTableMaster(tableId: string, deviceId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || existing.deviceId !== deviceId) return false;
  await prisma.tableOrderMaster.update({
    where: { tableId },
    data: { expiresAt: new Date(Date.now() + TABLE_MASTER_TTL_MS) },
  });
  return true;
}

export function isMasterDevice(record: TableMasterRecord | null, deviceId: string | null | undefined): boolean {
  return Boolean(record && deviceId && record.deviceId === deviceId);
}

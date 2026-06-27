import prisma from "@/lib/prisma";
import { clearTableDraftCart } from "@/lib/table-draft-cart";
import { isStaffDeviceId } from "@/lib/staff-session";

export const TABLE_MASTER_TTL_MS = 4 * 60 * 60 * 1000;
/** Sans activité serveur sur la table, le verrou staff est considéré abandonné. */
export const STAFF_MASTER_IDLE_MS = 2 * 60 * 1000;
/** Sans signal du téléphone maître convive (page fermée / appli en arrière-plan), libération auto. */
export const CLIENT_MASTER_IDLE_MS = 3 * 60 * 1000;

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

export function isStaffMasterRecord(record: TableMasterRecord | null): boolean {
  return Boolean(record && isStaffDeviceId(record.deviceId));
}

export function isStaffMasterIdle(record: TableMasterRecord, now = Date.now()): boolean {
  return now - record.claimedAt.getTime() > STAFF_MASTER_IDLE_MS;
}

export function isClientMasterRecord(record: TableMasterRecord | null): boolean {
  return Boolean(record && !isStaffDeviceId(record.deviceId));
}

export function isClientMasterIdle(record: TableMasterRecord, now = Date.now()): boolean {
  return now - record.claimedAt.getTime() > CLIENT_MASTER_IDLE_MS;
}

/** Supprime un verrou serveur laissé ouvert après départ de la tablette. */
export async function clearStaleStaffMaster(tableId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || !isStaffMasterRecord(existing) || !isStaffMasterIdle(existing)) {
    return false;
  }
  await prisma.tableOrderMaster.delete({ where: { tableId } }).catch(() => {});
  return true;
}

/** Supprime un verrou convive sans activité (téléphone fermé, onglet quitté). */
export async function clearStaleClientMaster(tableId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || !isClientMasterRecord(existing) || !isClientMasterIdle(existing)) {
    return false;
  }
  await prisma.tableOrderMaster.delete({ where: { tableId } }).catch(() => {});
  await clearTableDraftCart(tableId);
  return true;
}

export async function clearStaleMasters(tableId: string): Promise<void> {
  await clearStaleStaffMaster(tableId);
  await clearStaleClientMaster(tableId);
}

export async function claimTableMaster(
  tableId: string,
  deviceId: string
): Promise<{ ok: true; record: TableMasterRecord } | { ok: false; code: "TAKEN" }> {
  await clearStaleMasters(tableId);
  const existing = await getTableMaster(tableId);
  if (existing && existing.deviceId !== deviceId) {
    const staleStaff = isStaffMasterRecord(existing) && isStaffMasterIdle(existing);
    const staleClient = isClientMasterRecord(existing) && isClientMasterIdle(existing);
    if (staleStaff || staleClient) {
      await prisma.tableOrderMaster.delete({ where: { tableId } });
    } else {
      return { ok: false, code: "TAKEN" };
    }
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

/** Prise de contrôle forcée (serveur / staff) — remplace le maître actuel. */
export async function forceClaimTableMaster(
  tableId: string,
  deviceId: string
): Promise<TableMasterRecord> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TABLE_MASTER_TTL_MS);
  return prisma.tableOrderMaster.upsert({
    where: { tableId },
    create: { tableId, deviceId, claimedAt: now, expiresAt },
    update: { deviceId, claimedAt: now, expiresAt },
  });
}

export async function releaseTableMaster(tableId: string, deviceId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || existing.deviceId !== deviceId) return false;
  await prisma.tableOrderMaster.delete({ where: { tableId } });
  return true;
}

/** Libère le verrou maître après envoi de commande (tous appareils peuvent reprendre). */
export async function clearTableMaster(tableId: string): Promise<void> {
  await prisma.tableOrderMaster.delete({ where: { tableId } }).catch(() => {});
}

export async function touchTableMaster(tableId: string, deviceId: string): Promise<boolean> {
  const existing = await getTableMaster(tableId);
  if (!existing || existing.deviceId !== deviceId) return false;
  const now = new Date();
  await prisma.tableOrderMaster.update({
    where: { tableId },
    data: {
      claimedAt: now,
      expiresAt: new Date(now.getTime() + TABLE_MASTER_TTL_MS),
    },
  });
  return true;
}

export function isMasterDevice(record: TableMasterRecord | null, deviceId: string | null | undefined): boolean {
  return Boolean(record && deviceId && record.deviceId === deviceId);
}

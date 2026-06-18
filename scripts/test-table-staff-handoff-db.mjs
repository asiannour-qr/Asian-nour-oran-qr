#!/usr/bin/env node
/**
 * Test handoff convive → serveur via Prisma (sans cookies HTTP).
 * Table isolée 99 — ne jamais utiliser la table 1 en prod.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.log("⏭️  test:handoff ignoré (DATABASE_URL absent)");
  process.exit(0);
}

const isCiPlaceholderDb = /127\.0\.0\.1:5432\/ci/.test(process.env.DATABASE_URL);
if (isCiPlaceholderDb) {
  console.log("⏭️  test:handoff ignoré (URL CI factice — pas de base Neon)");
  process.exit(0);
}

const prisma = new PrismaClient();
const TABLE = process.env.TEST_TABLE_ID || "99";
const CLIENT = "test-db-client-handoff";
const STAFF = `staff-serv-${TABLE}`;
const TTL_MS = 4 * 60 * 60 * 1000;

async function claim(tableId, deviceId) {
  const now = new Date();
  await prisma.tableOrderMaster.upsert({
    where: { tableId },
    create: {
      tableId,
      deviceId,
      claimedAt: now,
      expiresAt: new Date(now.getTime() + TTL_MS),
    },
    update: {
      deviceId,
      claimedAt: now,
      expiresAt: new Date(now.getTime() + TTL_MS),
    },
  });
}

async function release(tableId, deviceId) {
  const row = await prisma.tableOrderMaster.findUnique({ where: { tableId } });
  if (row?.deviceId === deviceId) {
    await prisma.tableOrderMaster.delete({ where: { tableId } });
  }
}

async function cleanup() {
  await release(TABLE, STAFF);
  await release(TABLE, CLIENT);
  await prisma.tableDraftCart.delete({ where: { tableId: TABLE } }).catch(() => {});
}

async function main() {
  console.log(`\n🧪 Test handoff DB table ${TABLE}\n`);
  await cleanup();

  await claim(TABLE, CLIENT);
  console.log("✓ Client maître");

  await prisma.tableDraftCart.upsert({
    where: { tableId: TABLE },
    create: {
      tableId: TABLE,
      items: [{ id: "db-soupe", name: "Soupe DB", priceCents: 450, qty: 1, personId: "P1" }],
      peopleCount: 2,
      tableComment: "Test DB",
      guestNames: { 1: "Lea", 2: "Max" },
      updatedAt: new Date(),
    },
    update: {
      items: [{ id: "db-soupe", name: "Soupe DB", priceCents: 450, qty: 1, personId: "P1" }],
      peopleCount: 2,
      tableComment: "Test DB",
      guestNames: { 1: "Lea", 2: "Max" },
    },
  });
  console.log("✓ Brouillon client");

  await claim(TABLE, STAFF);
  const master = await prisma.tableOrderMaster.findUnique({ where: { tableId: TABLE } });
  if (master?.deviceId !== STAFF) throw new Error("Serveur pas maître");
  console.log("✓ Serveur maître (force simulé)");

  const draft = await prisma.tableDraftCart.findUnique({ where: { tableId: TABLE } });
  if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) {
    throw new Error("Draft vide après handoff");
  }
  if (!draft?.guestNames || String(draft.guestNames?.["1"] ?? draft.guestNames?.[1] ?? "") !== "Lea") {
    throw new Error(`Noms convives perdus: ${JSON.stringify(draft?.guestNames)}`);
  }
  console.log("✓ Brouillon conservé (plats + convives)");

  await prisma.tableDraftCart.update({
    where: { tableId: TABLE },
    data: {
      items: [
        ...draft.items,
        { id: "db-staff", name: "Ajout staff", priceCents: 100, qty: 1, personId: "P2" },
      ],
    },
  });
  console.log("✓ Serveur modifie le brouillon");

  await release(TABLE, STAFF);
  await claim(TABLE, CLIENT);
  const after = await prisma.tableDraftCart.findUnique({ where: { tableId: TABLE } });
  const items = Array.isArray(after?.items) ? after.items : [];
  if (!items.some((i) => i.id === "db-staff")) throw new Error("Ajout staff perdu");
  console.log("✓ Client reprend le panier mis à jour");

  await cleanup();
  console.log("\n✅ Handoff DB OK\n");
}

main()
  .catch(async (err) => {
    console.error("\n❌", err.message || err);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

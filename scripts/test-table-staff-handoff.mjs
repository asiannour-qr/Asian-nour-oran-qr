#!/usr/bin/env node
/**
 * Test : convive en commande → serveur reprend la table 1 en cours de route.
 * Usage: node scripts/test-table-staff-handoff.mjs [baseUrl]
 */
import { createHmac } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

function cookieHeader() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    "asian-nour-dev-secret";
  const exp = Date.now() + 3600 * 1000;
  const payload = `KITCHEN.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `kitchen=${payload}.${sig}`;
}

const BASE = (process.argv[2] || process.env.TEST_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const TABLE = process.env.TEST_TABLE_ID || "99";
const CLIENT_ID = "test-client-handoff-001";
const STAFF_ID = `staff-serv-${TABLE}`;

const draftPayload = {
  deviceId: CLIENT_ID,
  items: [
    { id: "test-soupe", name: "Soupe test", priceCents: 450, qty: 2, personId: "P1" },
    { id: "test-gyoza", name: "Gyoza test", priceCents: 550, qty: 1, personId: "P2" },
  ],
  peopleCount: 2,
  tableComment: "Test handoff serveur",
  guestNames: { 1: "Alice", 2: "Bob" },
};

async function req(method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function cleanup() {
  await req("DELETE", `/api/tables/${TABLE}/master`, {
    body: { deviceId: STAFF_ID },
    headers: { Cookie: cookieHeader() },
  }).catch(() => {});
  await req("DELETE", `/api/tables/${TABLE}/master`, {
    body: { deviceId: CLIENT_ID },
  }).catch(() => {});
  await req("DELETE", `/api/tables/${TABLE}/draft-cart`).catch(() => {});
}

async function main() {
  console.log(`\n🧪 Test handoff table ${TABLE} sur ${BASE}\n`);

  await cleanup();

  // 1. Convive prend la main
  let r = await req("POST", `/api/tables/${TABLE}/master`, {
    body: { deviceId: CLIENT_ID },
  });
  assert(r.ok && r.data?.isMaster, `Client claim: ${JSON.stringify(r.data)}`);
  console.log("✓ Client maître");

  // 2. Panier en cours
  r = await req("PUT", `/api/tables/${TABLE}/draft-cart`, { body: draftPayload });
  assert(r.ok, `Draft PUT client: ${JSON.stringify(r.data)}`);
  console.log("✓ Brouillon enregistré (2 convives, 2 plats)");

  // 3. Serveur force la prise (milieu de commande)
  r = await req("POST", `/api/tables/${TABLE}/master`, {
    body: { deviceId: STAFF_ID, force: true },
    headers: { Cookie: cookieHeader() },
  });
  assert(r.ok && r.data?.isMaster && r.data?.forced, `Staff force claim: ${JSON.stringify(r.data)}`);
  assert(Array.isArray(r.data?.draft?.items) && r.data.draft.items.length >= 2, "Draft absent dans réponse staff");
  console.log("✓ Serveur maître (force)");

  // 4. Vérifier statut maître
  r = await req("GET", `/api/tables/${TABLE}/master?deviceId=${encodeURIComponent(STAFF_ID)}`);
  assert(r.ok && r.data?.isMaster && r.data?.masterType === "staff", `Staff master GET: ${JSON.stringify(r.data)}`);
  console.log("✓ GET master confirme staff");

  r = await req("GET", `/api/tables/${TABLE}/master?deviceId=${encodeURIComponent(CLIENT_ID)}`);
  assert(r.ok && !r.data?.isMaster && r.data?.masterType === "staff", `Client plus maître: ${JSON.stringify(r.data)}`);
  console.log("✓ Client n'est plus maître");

  // 5. Brouillon lisible
  r = await req("GET", `/api/tables/${TABLE}/draft-cart`);
  assert(r.ok && r.data?.draft?.peopleCount === 2, `Draft GET: ${JSON.stringify(r.data)}`);
  assert(r.data?.draft?.guestNames?.["1"] === "Alice", "Noms convives manquants");
  assert(r.data?.draft?.items?.length >= 2, "Items manquants dans draft");
  console.log("✓ Brouillon intact (convives + plats)");

  // 6. Serveur modifie le panier
  r = await req("PUT", `/api/tables/${TABLE}/draft-cart`, {
    body: {
      deviceId: STAFF_ID,
      ...draftPayload,
      items: [
        ...draftPayload.items,
        { id: "test-staff-add", name: "Ajout serveur", priceCents: 300, qty: 1, personId: "P1" },
      ],
    },
  });
  assert(r.ok, `Staff draft PUT: ${JSON.stringify(r.data)}`);
  console.log("✓ Serveur peut modifier le brouillon");

  // 7. Serveur rend la main
  r = await req("DELETE", `/api/tables/${TABLE}/master`, {
    body: { deviceId: STAFF_ID },
    headers: { Cookie: cookieHeader() },
  });
  assert(r.ok, `Staff release: ${JSON.stringify(r.data)}`);
  console.log("✓ Serveur libère la table");

  // 8. Client reprend
  r = await req("POST", `/api/tables/${TABLE}/master`, {
    body: { deviceId: CLIENT_ID },
  });
  assert(r.ok && r.data?.isMaster, `Client reclaim: ${JSON.stringify(r.data)}`);
  assert(r.data?.draft?.items?.some((i) => i.id === "test-staff-add"), "Ajout serveur perdu");
  console.log("✓ Client reprend avec le panier mis à jour");

  await cleanup();
  console.log("\n✅ Tous les tests handoff table/serveur sont passés.\n");
}

main().catch(async (err) => {
  console.error("\n❌", err.message || err);
  await cleanup().catch(() => {});
  process.exit(1);
});

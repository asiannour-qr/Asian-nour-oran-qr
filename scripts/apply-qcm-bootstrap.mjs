#!/usr/bin/env node
/**
 * Applique la configuration QCM sur une ou plusieurs bases (identité, horaires 2 créneaux,
 * 25 tables, auto-print, compte cuisine, menus Royal/Classe B).
 *
 * Usage: node scripts/apply-qcm-bootstrap.mjs [--site fleury|oran|tours|all]
 */

import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const { seedHotMenus } = require("./import-hot-menus.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SIBLING = join(ROOT, "..");

const SETTINGS_ID = "default";

function loadDatabaseUrl(site) {
  const candidates = {
    fleury: [join(ROOT, ".env"), join(ROOT, ".env.local")],
    oran: [
      join(SIBLING, "Asian Nour Oran QR", ".env.local"),
      join(SIBLING, "Asian Nour Oran QR", ".env"),
      join(SIBLING, "Asian Nour Oran QR", ".env.bak"),
    ],
    tours: [join(SIBLING, "Asian Nour Tours QR", ".env"), join(SIBLING, "Asian Nour Tours QR", ".env.local")],
  }[site];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf8");
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`DATABASE_URL introuvable pour ${site}`);
}

function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function buildWeekHours(slot) {
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  return Object.fromEntries(jours.map((j) => [j, { ...slot }]));
}

const SITE_CONFIGS = {
  fleury: {
    restaurantName: "ASIAN NOUR FLEURY-LES-AUBRAIS",
    address: "43 RUE ANDRE DESSEAUX, 45400 FLEURY LES AUBRAIS",
    phone: "02.38.73.71.80",
    tableCount: 25,
    autoPrintEnabled: true,
    openingHours: buildWeekHours({
      ouvert: true,
      debut: "11:30",
      fin: "14:30",
      debut2: "18:30",
      fin2: "22:30",
    }),
    kitchen: { username: "cuisine", password: "fleury24", force: true },
  },
  oran: {
    restaurantName: "ASIAN NOUR ORAN",
    address: "Akid Lotfi (À Coté de clinique Ziane)",
    phone: "040.53.09.25",
    tableCount: 25,
    autoPrintEnabled: true,
    openingHours: buildWeekHours({
      ouvert: true,
      debut: "11:00",
      fin: "00:00",
      continu: true,
    }),
    kitchen: { username: "cuisine", password: "oran24", force: false },
  },
  tours: {
    restaurantName: "ASIAN NOUR TOURS",
    address: "15 rue Lavoisier 37000 Tours",
    phone: "09.88.04.32.01",
    tableCount: 25,
    autoPrintEnabled: true,
    openingHours: buildWeekHours({
      ouvert: true,
      debut: "11:30",
      fin: "14:00",
      debut2: "19:00",
      fin2: "23:00",
    }),
    kitchen: { username: "cuisine", password: "tours24", force: false },
  },
};

async function ensureKitchenAccount(prisma, kitchen) {
  const existing = await prisma.appCredential.findUnique({ where: { role: "KITCHEN" } });
  if (existing && !kitchen.force) {
    console.log(`  cuisine: compte existant (${existing.username}) — conservé`);
    return;
  }
  const passwordHash = hashPassword(kitchen.password);
  await prisma.appCredential.upsert({
    where: { role: "KITCHEN" },
    create: {
      role: "KITCHEN",
      username: kitchen.username,
      passwordHash,
    },
    update: {
      username: kitchen.username,
      passwordHash,
    },
  });
  console.log(`  cuisine: ${kitchen.username} / ${kitchen.password}`);
}

async function applySite(siteKey) {
  const config = SITE_CONFIGS[siteKey];
  const databaseUrl = loadDatabaseUrl(siteKey);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  console.log(`\n=== ${siteKey.toUpperCase()} ===`);

  try {
    await prisma.restaurantSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        restaurantName: config.restaurantName,
        address: config.address,
        phone: config.phone,
        tableCount: config.tableCount,
        autoPrintEnabled: config.autoPrintEnabled,
        kitchenSoundEnabled: true,
        openingHours: config.openingHours,
      },
      update: {
        restaurantName: config.restaurantName,
        address: config.address,
        phone: config.phone,
        tableCount: config.tableCount,
        autoPrintEnabled: config.autoPrintEnabled,
        openingHours: config.openingHours,
      },
    });
    console.log(`  settings: ${config.restaurantName}, ${config.tableCount} tables, auto-print ON`);

    await ensureKitchenAccount(prisma, config.kitchen);

    const menuResult = await seedHotMenus(prisma, { deactivateLegacy: false });
    console.log(
      `  menus: ${menuResult.menusCreated} créés, ${menuResult.groupsCreated} groupes ajoutés, ${menuResult.groupsUpdated} mis à jour`
    );
  } finally {
    await prisma.$disconnect();
  }
}

const argSite = process.argv.find((a) => a.startsWith("--site="))?.split("=")[1] ?? "all";
const sites =
  argSite === "all" ? Object.keys(SITE_CONFIGS) : argSite.split(",").map((s) => s.trim());

for (const site of sites) {
  if (!SITE_CONFIGS[site]) {
    console.error(`Site inconnu: ${site}`);
    process.exit(1);
  }
}

for (const site of sites) {
  await applySite(site);
}

console.log("\nBootstrap QCM terminé.");

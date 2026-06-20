#!/usr/bin/env node
/**
 * Télécharge les visuels depuis l'instance source (Orléans par défaut),
 * puis assigne imageUrl aux MenuItem / Menu en base via correspondance nom + catégorie.
 *
 * Usage:
 *   node scripts/sync-menu-images.mjs
 *   IMAGE_SOURCE_URL=https://... node scripts/sync-menu-images.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const DEST_DIR = path.join(process.cwd(), "public", "uploads");
const MAP_PATH = path.join(__dirname, "menu-image-map.json");

const STOP_WORDS = new Set([
  "pcs",
  "pieces",
  "piece",
  "pièces",
  "pièce",
  "box",
  "personnes",
  "personne",
  "the",
  "and",
  "avec",
  "servi",
  "nature",
]);

function normalize(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shortName(name) {
  return (name || "").split("(")[0].trim();
}

function slugify(filename) {
  const ext = path.extname(filename).toLowerCase();
  const base = path
    .basename(filename, path.extname(filename))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}${ext}`;
}

function scoreMatch(item, fileStem) {
  const nameToks = normalize(shortName(item.name)).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  const catToks = normalize(item.category).split(" ").filter((t) => t.length > 2);
  const stemToks = normalize(fileStem.replace(/-/g, " ")).split(" ").filter(Boolean);
  if (!nameToks.length || !stemToks.length) return 0;

  let score = 0;
  for (const tok of nameToks) {
    if (stemToks.includes(tok)) score += 3;
    else if (stemToks.some((s) => s.includes(tok) || tok.includes(s))) score += 1;
  }
  for (const tok of catToks) {
    if (stemToks.includes(tok)) score += 1;
  }

  const cat = normalize(item.category);
  if (cat.includes("maki") && fileStem.includes("maki")) score += 2;
  if (cat.includes("flocon") && fileStem.includes("flocon")) score += 2;
  if (cat.includes("crunch") && fileStem.includes("crunch")) score += 2;
  if (cat.includes("california") && fileStem.includes("california")) score += 2;
  if (cat.includes("printemps") && fileStem.includes("printemps")) score += 2;
  if (cat.includes("frit") && fileStem.includes("frit")) score += 2;
  if (cat.includes("saumon roll") && fileStem.includes("saumon-roll")) score += 2;
  if (cat.includes("avocat roll") && fileStem.includes("avocat-roll")) score += 2;
  if (cat.includes("chirash") && fileStem.includes("chirash")) score += 2;
  if (cat.includes("poke") && fileStem.includes("poke")) score += 2;
  if (cat.includes("yakitori") && fileStem.includes("yakitori")) score += 2;
  if (cat.includes("udon") && fileStem.includes("udon")) score += 2;
  if (cat.includes("bobun") && fileStem.includes("bobun")) score += 2;
  if (cat.includes("spicy") && fileStem.includes("spicy")) score += 2;
  if (cat.includes("kao pad") && fileStem.includes("kao-pad")) score += 2;
  if (cat.includes("pad thai") && fileStem.includes("pad-thai")) score += 2;

  const nameNorm = normalize(item.name);
  if (fileStem.includes("boursin") && !nameNorm.includes("boursin")) score -= 4;
  if (fileStem.includes("chevre") && !nameNorm.includes("chevre")) score -= 3;
  if (fileStem.includes("cheese") && !nameNorm.includes("cheese")) score -= 2;
  if (fileStem.includes("boulettes") && !nameNorm.includes("boulettes")) score -= 5;

  return score;
}

async function fetchSourceManifest(sourceBaseUrl) {
  const res = await fetch(`${sourceBaseUrl}/api/menu?all=1`);
  if (!res.ok) throw new Error(`Impossible de lire le menu source (${res.status})`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items || [];
  const files = new Set();
  for (const item of items) {
    if (item.imageUrl) files.add(item.imageUrl.replace(/^\/uploads\//, ""));
  }
  return { items, files: [...files].sort() };
}

async function downloadFile(sourceBaseUrl, filename, destPath) {
  if (existsSync(destPath)) return false;
  const res = await fetch(`${sourceBaseUrl}/uploads/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(`Téléchargement impossible: ${filename} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return true;
}

function resolveImageFile(item, availableFiles, overrides) {
  const keys = [
    `${item.category}::${item.name}`,
    `${item.category}::${shortName(item.name)}`,
    item.name,
    shortName(item.name),
  ];
  for (const key of keys) {
    if (overrides[key]) return overrides[key];
  }

  let best = null;
  let bestScore = 0;
  for (const file of availableFiles) {
    const stem = path.basename(file, path.extname(file));
    const score = scoreMatch(item, stem);
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }
  return bestScore >= 4 ? best : null;
}

async function main() {
  const map = JSON.parse(await readFile(MAP_PATH, "utf8"));
  const sourceBaseUrl = (process.env.IMAGE_SOURCE_URL || map.sourceBaseUrl || "").replace(/\/+$/, "");
  if (!sourceBaseUrl) throw new Error("IMAGE_SOURCE_URL ou sourceBaseUrl requis");

  await mkdir(DEST_DIR, { recursive: true });

  console.log(`📡 Source images: ${sourceBaseUrl}`);
  const { files: sourceFiles } = await fetchSourceManifest(sourceBaseUrl);
  const availableFiles = new Set(sourceFiles);
  Object.values(map.overrides || {}).forEach((f) => availableFiles.add(f));
  Object.values(map.composedMenus || {}).forEach((f) => availableFiles.add(f));

  const needed = [...availableFiles];
  console.log(`⬇️  ${needed.length} fichiers à synchroniser…`);
  let downloaded = 0;
  for (const file of needed) {
    const finalName = slugify(file);
    const finalPath = path.join(DEST_DIR, finalName);
    if (existsSync(finalPath)) continue;
    try {
      const fresh = await downloadFile(sourceBaseUrl, file, finalPath);
      if (fresh) downloaded += 1;
    } catch (err) {
      console.warn(`⚠️  ${file}: ${err.message}`);
    }
  }
  console.log(`✅ ${downloaded} nouveaux fichiers téléchargés`);

  const menuItems = await prisma.menuItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  let assigned = 0;
  let cleared = 0;
  const unmatched = [];

  for (const item of menuItems) {
    const file = resolveImageFile(item, [...availableFiles], map.overrides || {});
    if (!file) {
      if (item.imageUrl) {
        await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl: null } });
        cleared += 1;
      }
      unmatched.push(`[${item.category}] ${item.name}`);
      continue;
    }
    const imageUrl = `/uploads/${slugify(file)}`;
    if (item.imageUrl !== imageUrl) {
      await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl } });
      assigned += 1;
      console.log(`🖼  [${item.category}] ${item.name} -> ${slugify(file)}`);
    }
  }

  const menus = await prisma.menu.findMany();
  for (const menu of menus) {
    const file = map.composedMenus?.[menu.name];
    if (!file) continue;
    const imageUrl = `/uploads/${slugify(file)}`;
    if (menu.imageUrl !== imageUrl) {
      await prisma.menu.update({ where: { id: menu.id }, data: { imageUrl } });
      assigned += 1;
      console.log(`🍱 ${menu.name} -> ${slugify(file)}`);
    }
  }

  console.log(`\n${assigned} image(s) assignée(s), ${cleared} retirée(s) (non pertinentes).`);
  if (unmatched.length) {
    console.log(`\nSans visuel (${unmatched.length}) :`);
    unmatched.forEach((line) => console.log(` - ${line}`));
  }
}

main()
  .catch((err) => {
    console.error("❌ sync-menu-images:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

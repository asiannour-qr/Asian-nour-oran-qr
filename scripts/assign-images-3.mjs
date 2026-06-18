// Import vague 3 : entrées, accompagnements, plats silver, sashimis, originaux…
// Copie images-a-importer/ -> public/uploads/ puis assigne imageUrl en base.
// Usage: node scripts/assign-images-3.mjs
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const SRC_DIR = path.join(process.cwd(), "images-a-importer");
const DEST_DIR = path.join(process.cwd(), "public", "uploads");

// fichier source -> id(s) MenuItem (tableau = même image pour plusieurs articles)
const MAPPING = {
  "riz-nature.png": "cmgv70eqt000dg5ah03tktsmd", // Accompagnements / Riz nature
  "salade-de-choux.png": "cmgv70epo000cg5ahw8yxukyf", // Accompagnements / Salade de choux
  "salade-dynamite.png": "cmgv70hjh002vg5ahsnbxxbwl", // Asian Extras / Salade dynamite
  "tom-yam.png": "cmgv70hie002ug5ahtu7cvqa8", // Asian Extras / Tom Yam
  "3-crevettes-tempura.png": "cmgv70ee10002g5ahu4q7o0oi", // Entrées / 3 Crevettes tempura
  "3-crousty-saumon.png": "cmgv70egc0004g5ahbc7x4u13", // Entrées / 3 Croustys saumon
  "3-nems-crevettes.png": "cmgv70ecw0001g5ah5b8o8nra", // Entrées / 3 Nems crevettes
  "4-gyoza-legumes.png": "cmgv70ef60003g5ah16kzmywj", // Entrées / 4 Gyoza légumes
  "cesars.png": "cmgv70grs0026g5ahemsmfbn8", // Les originaux / Césars
  "mangos.png": "cmgv70gpk0024g5ahgl526iwe", // Les originaux / Mangos
  "udon-boeuf.png": "cmgv70fbw000wg5ahf3qguqjl", // Plats Gold / Udon boeuf
  "udon-crevettes.png": "cmgv70fd2000xg5ahszsx0wio", // Plats Gold / Udon crevettes
  "nouilles-sautees-boeuf.png": "cmgv70exg000jg5ahhxj0zepn", // Plats Silver / Nouilles sautées boeuf
  "nouilles-sautees-crevettes.png": "cmgv70eyk000kg5ah1v9gf7al", // Plats Silver / Nouilles sautées crevettes
  "nouilles-sautees-poulet.png": "cmgv70ew9000ig5ahxbevrwih", // Plats Silver / Nouilles sautées poulet
  "riz-cantonais.png": "cmgv70ev6000hg5ahxceob9kq", // Plats Starter / Riz cantonnais
  // Même photo pour les deux formats
  "sashimi-saumon-5-pieces.png": ["cmgv70hkm002wg5ahi8wakmlo", "cmgv70hlq002xg5ahnxaab5g4"], // Sashimi saumon 5 + 12 pcs
  "sashimi-thon-5-pieces.png": "cmgv70hmv002yg5ah4gx4tnmv", // Sashimi thon 5 pcs
  "sashimi-thon-10-pieces.png": "cmgv70hny002zg5ah8d246ryk", // Sashimi thon 12 pcs
};

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

async function main() {
  await mkdir(DEST_DIR, { recursive: true });
  let ok = 0;
  let total = 0;
  const errors = [];

  for (const [file, target] of Object.entries(MAPPING)) {
    const ids = Array.isArray(target) ? target : [target];
    const src = path.join(SRC_DIR, file);
    if (!existsSync(src)) {
      errors.push(`fichier introuvable: ${file}`);
      total += ids.length;
      continue;
    }
    const destName = slugify(file);
    const dest = path.join(DEST_DIR, destName);
    try {
      await copyFile(src, dest);
    } catch (e) {
      errors.push(`${file}: copie impossible (${e.message})`);
      total += ids.length;
      continue;
    }
    for (const itemId of ids) {
      total += 1;
      try {
        const item = await prisma.menuItem.update({
          where: { id: itemId },
          data: { imageUrl: `/uploads/${destName}` },
          select: { name: true, category: true },
        });
        ok += 1;
        console.log(`OK  ${file} -> [${item.category}] ${item.name}`);
      } catch (e) {
        errors.push(`${file} (${itemId}): ${e.message}`);
      }
    }
  }

  console.log(`\n${ok}/${total} assignations réussies.`);
  if (errors.length) {
    console.log("\nErreurs:");
    for (const err of errors) console.log(" -", err);
  }

  const noImage = await prisma.menuItem.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: "" }] },
    select: { name: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  console.log(`\nArticles encore sans image (${noImage.length}):`);
  for (const it of noImage) console.log(` - [${it.category}] ${it.name}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

// Import vague 2 : nouvelles photos (plats chauds, yakitoris, desserts, eaux…)
// Copie images-a-importer/ -> public/uploads/ puis assigne imageUrl en base.
// Usage: node scripts/assign-images-2.mjs
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const SRC_DIR = path.join(process.cwd(), "images-a-importer");
const DEST_DIR = path.join(process.cwd(), "public", "uploads");

// fichier source -> id(s) MenuItem (tableau = même image pour plusieurs articles)
const MAPPING = {
  "6-poulets-dynamite.jpg": "cmgv70ehh0005g5ahkdel7nog", // Entrées / 6 Poulets dynamites
  "bobun-boeuf.jpg": "cmgv70f8j000tg5ahki5l783v", // Plats Gold / Bobun boeuf
  "bobun-poulet.jpg": "cmgv70f7f000sg5ahlt1l50a1", // Plats Gold / Bobun poulet
  "boulettes-de-boeuf.jpg": "cmgv70emb0009g5ahg139q8f4", // Yakitoris / Boulettes de boeuf
  "crousti-fromage.jpg": "cmgv70enh000ag5ahx81br56h", // Yakitoris / Crousty fromage
  "yakitoris-saumon.jpg": "cmgv70el70008g5ahw4rjsqnu", // Yakitoris / Saumon
  "flocon-poulet-mayonnaise.jpg": "cmgv70fqq0019g5ahfycbmv2z", // Flocons / Poulet mayonnaise
  "maki-avocat-cheese.jpg": "cmgv70fob0017g5ah5wbzkrxu", // Makis / Avocat cheese
  "kao-pad-thai-légumes.jpg": "cmgv70eu3000gg5aho4a1c02s", // Plats Starter / Kao pad thaï légumes
  "nouilles-légumes.jpg": "cmgv70et0000fg5ah7d1114zi", // Plats Starter / Nouilles sautées légumes
  "riz-vinaigré.jpg": "cmgv70erw000eg5ahhq4lgm93", // Accompagnements / Riz vinaigré
  "spicy-boeuf.jpg": "cmgv70f58000qg5ahkyzdi2dg", // Plats Gold / Spicy boeuf
  "spicy-crevettes.jpg": "cmgv70f6b000rg5ah7jcmj7l6", // Plats Gold / Spicy crevettes
  "spicy-peanut's-poulet.jpg": "cmgv70fe5000yg5ah29kahhu4", // Plats Gold / Spicy peanuts poulet
  "spicy-poulet.jpg": "cmgv70f42000pg5ah9x8of8ib", // Plats Gold / Spicy poulet
  "fondant-crème-anglaise.jpg": "cmgv70i3f003dg5ah7v4ulg1r", // Desserts / Fondant chocolat crème anglaise
  "tiramisu-framboise.jpg": "cmgv70i19003bg5ahha6xyscd", // Desserts / Tiramisu fait maison (représentatif)
  // Même bouteille pour les deux contenances
  "eau-minérale-50cl.jpg": ["cmgv70hvr0036g5ahj2boqufx", "cmgv70hxz0038g5ahm0q5vo81"], // Eau minérale 50cl + 1L
  "eau-petillante.jpg": ["cmgv70hww0037g5ahb8u6i4rv", "cmgv70hz20039g5ahzm8jisfn"], // Eau pétillante 50cl + 1L
  // Image générique pour le soft drink
  "DADA-COLA.png": "cmgv70i06003ag5ah3d8ums9k", // Boissons / Soft drink (représentatif)
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

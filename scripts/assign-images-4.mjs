// Import vague 4 : boxes, desserts, boissons, rolls manquants
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();
const SRC_DIR = path.join(process.cwd(), "images-a-importer");
const DEST_DIR = path.join(process.cwd(), "public", "uploads");

const MAPPING = {
  "box-36-pieces.png": "cmgv70hti0034g5ahj0lmo3g8",
  "box-54-pieces.png": "cmgv70huo0035g5ahy5hs9jpz",
  "selecto.png": "cmq6k4j7w0000lz4uzswidy3g",
  "capri-sun.png": "cmgvaoro700011261ifa959oy",
  "compote.png": "cmgvaorlm00001261i2tm9oop",
  "tarte-tatin-glace.jpg": "cmgv70i2c003cg5ahb0zq2ov9",
  "flocon-nutella-banane.jpg": "cmgv70i4i003eg5ah2ryuyvea",
  "futomaki-originaux.png": "cmgv70gsw0027g5ahq6m0fafn",
  "saumon-roll-braise-shichimi.png": "cmgv70g7j001og5ahytmza31v",
  "saumon-roll-thon-cuit-avocat.png": "cmgv70g46001lg5ah24te0avf",
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
  const errors = [];

  for (const [file, itemId] of Object.entries(MAPPING)) {
    const src = path.join(SRC_DIR, file);
    if (!existsSync(src)) {
      errors.push(`fichier introuvable: ${file}`);
      continue;
    }
    const destName = slugify(file);
    const dest = path.join(DEST_DIR, destName);
    try {
      await copyFile(src, dest);
      const item = await prisma.menuItem.update({
        where: { id: itemId },
        data: { imageUrl: `/uploads/${destName}` },
        select: { name: true, category: true },
      });
      ok += 1;
      console.log(`OK  ${file} -> [${item.category}] ${item.name}`);
    } catch (e) {
      errors.push(`${file}: ${e.message}`);
    }
  }

  console.log(`\n${ok}/${Object.keys(MAPPING).length} assignations réussies.`);
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

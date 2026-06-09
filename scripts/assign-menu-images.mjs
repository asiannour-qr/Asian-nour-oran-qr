// Assigne les visuels asian-* aux menus composés (modèle Menu)
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const SOURCE_DIR = path.join(process.cwd(), "images-a-importer");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

// nom exact du menu en base -> fichier source
const MAPPING = {
  "Asian Classic": "asian-classic.png",
  "Asian Classic +": "asian-classic-plus.png",
  "Asian Royal": "asian-royal.png",
  "Asian Classe B": "asian-classe-b.png",
  "Asian Express": "asian-express.png",
  "Asian Kid’s": "asian-kids.png",
};

async function main() {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const menus = await prisma.menu.findMany({ select: { id: true, name: true } });
  let assigned = 0;

  for (const [menuName, filename] of Object.entries(MAPPING)) {
    const menu = menus.find((m) => m.name === menuName);
    if (!menu) {
      console.log(`⚠️  Menu introuvable en base : "${menuName}"`);
      continue;
    }

    const destName = `composed-${filename}`;
    await copyFile(path.join(SOURCE_DIR, filename), path.join(UPLOADS_DIR, destName));
    const imageUrl = `/uploads/${destName}`;

    await prisma.menu.update({ where: { id: menu.id }, data: { imageUrl } });
    console.log(`✅ ${menuName} -> ${imageUrl}`);
    assigned++;
  }

  console.log(`\n${assigned}/${Object.keys(MAPPING).length} menus mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

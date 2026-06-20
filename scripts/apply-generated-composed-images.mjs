#!/usr/bin/env node
/** Met à jour imageUrl des menus composés depuis menu-image-map.json */
import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const mapPath = path.join(__dirname, "menu-image-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8"));
  const composed = map.composedMenus || {};

  for (const [name, file] of Object.entries(composed)) {
    const imageUrl = `/uploads/${file}`;
    const result = await prisma.menu.updateMany({ where: { name }, data: { imageUrl } });
    console.log(`${name}: ${result.count} -> ${imageUrl}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

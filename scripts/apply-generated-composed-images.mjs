#!/usr/bin/env node
/** Met à jour imageUrl des menus composés générés (Classic+ et Classe B). */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPDATES = {
  "Asian Classic +": "/uploads/generated/asian-classic-plus.png",
  "Asian Classe B": "/uploads/generated/asian-classe-b.png",
};

async function main() {
  for (const [name, imageUrl] of Object.entries(UPDATES)) {
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

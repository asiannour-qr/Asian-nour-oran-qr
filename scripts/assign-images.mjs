// Import des photos de la carte : copie images-a-importer/ -> public/uploads/
// puis assigne imageUrl aux articles correspondants en base.
// Usage: node scripts/assign-images.mjs
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const SRC_DIR = path.join(process.cwd(), "images-a-importer");
const DEST_DIR = path.join(process.cwd(), "public", "uploads");

// Correspondance fichier source -> id de l'article (MenuItem)
const MAPPING = {
  "ASIAN-CHIRACHIS-SAUMON.png": "cmgv70hbt002og5ah9mzrfan2", // Asian Chirashis / Saumon
  "ASIAN-CHIRACHIS-THON.png": "cmgv70he0002qg5ahxgjwadd0", // Asian Chirashis / Thon
  "ASIAN-CHIRASHIS-SAUMON-AVOCAT.png": "cmgv70hf2002rg5ahv6x4s46t", // Asian Chirashis / Saumon avocat
  "ASIAN-CHIRASHIS-THON-SAUMON.png": "cmgv70hcx002pg5ah8d1v0cta", // Asian Chirashis / Thon saumon
  "AVOCAT-ROLLS-BURRATA.png": "cmgv70h0r002eg5ahnyd4sofq", // Avocat Roll's / Burrata
  "AVOCAT-ROLLS-CHEESE.png": "cmgv70gzm002dg5ahs2zc8tfi", // Avocat Roll's / Cheese
  "AVOCAT-ROLLS-SAUMON-CHEESE.png": "cmgv70h1v002fg5ahboinur5x", // Avocat Roll's / Saumon fumé cheese
  "AVOCAT-ROLLS-SAUMON-CONCOMBRE-MAYO.png": "cmgv70h30002gg5ah43ygvv1g", // Avocat Roll's / Saumon concombre mayonnaise
  "AVOCAT-ROLLS-TEMPURA-SAUCE-EPICEE.png": "cmgv70h44002hg5ahh3fwr5es", // Avocat Roll's / Crevette tempura sauce épicée
  "BOBUN-CREVETTES.png": "cmgv70f9p000ug5ah5dx1df3c", // Plats Gold / Bobun crevettes
  "BOEUF-LOCLAC.png": "cmgv70fge0010g5ahddfpzf6l", // Plats Gold / Boeuf loc lac
  "CALIFORNIA-CONCOMBRE-CHEESE.png": "cmgv70ggl001wg5ahjkm8we3t", // Californias / Concombre cheese
  "CALIFORNIA-POULET-MAYO.png": "cmgv70gis001yg5ah8tgco6me", // Californias / Poulet mayonnaise
  "CALIFORNIA-SAUMON-AVOCAT.png": "cmgv70gef001ug5ahqidf6sgj", // Californias / Saumon avocat
  "CALIFORNIA-SAUMON-CHEESE.png": "cmgv70gho001xg5ah4mkttm89", // Californias / Saumon fumé cheese
  "CALIFORNIA-THON-CUIT-AVOCAT.png": "cmgv70gfh001vg5ahr8dogx8i", // Californias / Thon cuit avocat
  "CRUNCH-CONCOMBRE-CHEESE.png": "cmgv70fvc001dg5ahghnqwe2v", // Crunchs / Concombre cheese
  "CRUNCH-POULET-BOURSIN.png": "cmgv70fzr001hg5ahw4e9vkcq", // Crunchs / Poulet boursin
  "CRUNCH-SAUMON-FUMÉ-BOURSIN.png": "cmgv70fyo001gg5ah8k8t6t8t", // Crunchs / Saumon fumé boursin
  "CRUNCH-TEMPURA.png": "cmgv70fxk001fg5ah5du5ycq3", // Crunchs / Crevettes tempura
  "CRUNCH-THON-CUIT-AVOCAT.png": "cmgv70fwg001eg5ahrt90coog", // Crunchs / Thon cuit avocat
  "FLOCONS-CHEESE-AVOCAT.png": "cmgv70ft2001bg5ah5u31o3mc", // Flocons / Avocat cheese
  "FLOCONS-CREVETTES-AVOCAT-BOURSIN.png": "cmgv70fu7001cg5ah2f3xo0j2", // Flocons / Crevettes avocat boursin
  "FLOCONS-SAUMON-BOURSIN.png": "cmgv70fpl0018g5ahmxg9chfz", // Flocons / Saumon cheese (approx)
  "FLOCONS-THON-CUIT-AVOCAT.png": "cmgv70frw001ag5ahrbmegk2e", // Flocons / Thon cuit avocat
  "FRITS-AVOCAT-CHEESE-MIEL.png": "cmgv70gb4001rg5ahnt3h72zu", // Frits / Avocat cheese miel
  "FRITS-POULET-AVOCAT-CHEDDAR-CURRY.png": "cmgv70gdc001tg5ahl4uypbsx", // Frits / Poulet avocat cheddar curry
  "FRITS-SAUMON-AVOCAT-BOURSIN.png": "cmgv70gc9001sg5ahea4j06xn", // Frits / Saumon avocado boursin
  "FRITS-SAUMON.png": "cmgv70g8n001pg5ahv6zvffc1", // Frits / Saumon
  "FRITS-THON-CUIT-AVOCAT.png": "cmgv70g9s001qg5ahladrhkl9", // Frits / Thon cuit avocat
  "KAO-PAD-THAI-BOEUF.png": "cmgv70f0q000mg5ah4nook3ow", // Plats Silver / Kao pad thaï boeuf
  "KAO-PAD-THAI-CREVETTES.png": "cmgv70f1t000ng5ah0ja30ld5", // Plats Silver / Kao pad thaï crevettes
  "KAO-PAD-THAI-CROUSTY.png": "cmgv70fij0012g5ahp9hdx17b", // Plats Gold / Kao pad thaï crousty
  "KAO-PAD-THAI-POULET.png": "cmgv70ezn000lg5ahs7ofbq8c", // Plats Silver / Kao pad thaï poulet
  "MAKIS-CONCOMBRE-CHEESE.png": "cmgv70fn80016g5ahkonpilrm", // Makis / Concombre cheese
  "MAKIS-SAUMON-AVOCAT.png": "cmgv70flv0015g5ahw1dvbm7l", // Makis / Saumon avocat
  "MAKIS-SAUMON.png": "cmgv70fkr0014g5ahaanf469l", // Makis / Saumon
  "MAKIS-THON.png": "cmgv70fjo0013g5ah8hua0gxs", // Makis / Thon
  "MENU-ASIAN-COMBO.png": "cmgv70h6c002jg5ahphzag2v2", // Menus Froids / Asian Combo
  "MENU-ASIAN-FIRST.png": "cmgv70h58002ig5ahbybv205t", // Menus Froids / Asian First
  "MENU-ASIAN-MELI-MELO.png": "cmgv70h7h002kg5aha36nrvi5", // Menus Froids / Asian Meli Melo
  "NEMS-POULET.png": "cmgv70eb30000g5ahkgp1xcxf", // Entrées / 3 Nems poulet
  "ORIGINAL-CHÈVRE.png": "cmgv70goe0023g5ahjovk7dyk", // Les originaux / Chèvres
  "ORIGINAL-LATINOS.png": "cmgv70gqo0025g5ahyja5ouw3", // Les originaux / Latinos
  "PAD-THAI-CROUSTY.png": "cmgv70fhg0011g5ahwd15m1vf", // Plats Gold / Pad thaï crousty
  "POKE-CREVETTES.png": "cmgv70hha002tg5ahzd5zzaal", // Asian Pokes / 3 Tempura crevettes…
  "POKE-SAUMON.png": "cmgv70hg7002sg5ahj638byo1", // Asian Pokes / Saumon, avocat, mangue…
  "POULET-CROUSTILLANT.png": "cmgv70f2x000og5ahhbuqsjfm", // Plats Silver / Poulet croustillant
  "POULET-CURRY.png": "cmgv70ff9000zg5ahvh972808", // Plats Gold / Poulet curry
  "PRINTEMPS-CHEESE-CONCOMBRE.png": "cmgv70gu10028g5ahs6hn13z3", // Printemps / Concombre cheese
  "PRINTEMPS-POULET-CHÈVRE-FRAIS.png": "cmgv70gyi002cg5ahxpq30fdd", // Printemps / Poulet chèvre frais
  "PRINTEMPS-SAUMON-CHEESE.png": "cmgv70gwa002ag5ahn9w4kzgn", // Printemps / Saumon avocat menthe (approx)
  "PRINTEMPS-SAUMON-FUME-AVOCAT-BOURSIN.png": "cmgv70gxe002bg5ahpoom7uoa", // Printemps / Saumon fumé avocat boursin
  "PRINTEMPS-THON-CUIT-AVOCAT.png": "cmgv70gv40029g5ahxu1bukwe", // Printemps / Thon cuit avocat
  "SAUMON-ROLLS-AVOCAT-CHEESE.png": "cmgv70g20001jg5ahjxc15mea", // Saumon Roll's / Avocat cheese
  "SAUMON-ROLLS-CHEESE.png": "cmgv70g0w001ig5ah12rbyy0m", // Saumon Roll's / Cheese
  "SAUMON-ROLLS-CONCOMBRE-CHEESE.png": "cmgv70g32001kg5ahyu5z5vxy", // Saumon Roll's / Concombre cheese
  "SAUMON-ROLLS-SAUMON-FUME-CONCOMBRE-BOURSIN.png": "cmgv70g59001mg5ah0o49vu2p", // Saumon Roll's / Saumon fumé concombre boursin
  "SAUMON-ROLLS-SAUMON-FUMÉ-TEMPURA-AVOCAT-CHEESE.png": "cmgv70g6c001ng5ahhvhgaq0e", // Saumon Roll's / Braisé tempura avocat (approx)
  "SOUPE-MISO.png": "cmgv70eok000bg5aht5jg7m98", // Accompagnements / Soupe miso
  "SUSHIS-SAUMON-AVOCAT.png": "cmgv70gl20020g5ah7lja9il4", // Sushis / Saumon avocat
  "SUSHIS-SAUMON-BRAISE.png": "cmgv70gnb0022g5ahbu9atkej", // Sushis / Saumon braisé
  "SUSHIS-SAUMON.png": "cmgv70gjx001zg5ahwp2iz4vm", // Sushis / Saumon
  "SUSHIS-THON.png": "cmgv70gm60021g5ahlcbtzdq4", // Sushis / Thon
  "UDON-POULET.png": "cmgv70fau000vg5ahzyzpojtk", // Plats Gold / Udon poulet
  "YAKITORIS-BOEUF-FROMAGE.png": "cmgv70eiy0006g5ahtepkb608", // Yakitoris / Boeuf fromage
  "YAKITORIS-POULET.png": "cmgv70ek30007g5ahfa0rscr8", // Yakitoris / Poulet
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

  console.log(`\n${ok}/${Object.keys(MAPPING).length} images assignées.`);
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

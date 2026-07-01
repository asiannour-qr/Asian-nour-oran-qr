// scripts/import-hot-menus.js
// Idempotent upsert des menus chauds « Asian ... » avec Prisma.

const { PrismaClient } = require("@prisma/client");

const HOT_MENU_DEFS = [
  {
    name: "Asian Classic",
    priceCents: 1690,
    position: 10,
    groups: [
      { name: "Entrée", categoryFilter: "Entrées", minChoices: 1, maxChoices: 1 },
      { name: "Yakitori (paire)", categoryFilter: "Yakitoris (2 pièces)", minChoices: 1, maxChoices: 1 },
      { name: "Plat Starter", categoryFilter: "Plats Starter", minChoices: 1, maxChoices: 1 },
    ],
  },
  {
    name: "Asian Classic +",
    priceCents: 1890,
    position: 20,
    groups: [
      { name: "Entrée", categoryFilter: "Entrées", minChoices: 1, maxChoices: 1 },
      { name: "Yakitori (paire)", categoryFilter: "Yakitoris (2 pièces)", minChoices: 1, maxChoices: 1 },
      { name: "Plat Silver", categoryFilter: "Plats Silver", minChoices: 1, maxChoices: 1 },
    ],
  },
  {
    name: "Asian Royal",
    priceCents: 1890,
    position: 30,
    groups: [
      { name: "Entrée ou Yakitori", categoryFilter: "Entrée ou Yakitoris", minChoices: 1, maxChoices: 1 },
      { name: "Plat Gold", categoryFilter: "Plats Gold", minChoices: 1, maxChoices: 1 },
      { name: "Boisson", categoryFilter: "Boissons", minChoices: 1, maxChoices: 1 },
    ],
  },
  {
    name: "Asian Classe B",
    priceCents: 1590,
    position: 40,
    groups: [
      { name: "Entrée ou Yakitori", categoryFilter: "Entrée ou Yakitoris", minChoices: 1, maxChoices: 1 },
      { name: "Plat Silver", categoryFilter: "Plats Silver", minChoices: 1, maxChoices: 1 },
      { name: "Boisson", categoryFilter: "Boissons", minChoices: 1, maxChoices: 1 },
    ],
  },
  {
    name: "Asian Express",
    priceCents: 1390,
    position: 50,
    groups: [
      { name: "Entrée", categoryFilter: "Entrées", minChoices: 1, maxChoices: 1 },
      { name: "Plat Silver", categoryFilter: "Plats Silver", minChoices: 1, maxChoices: 1 },
      { name: "Boisson", categoryFilter: "Boissons", minChoices: 1, maxChoices: 1 },
    ],
  },
  {
    name: "Asian Kid’s",
    priceCents: 890,
    position: 60,
    groups: [
      {
        name: "Nems ou Yakitori poulet",
        categoryFilter: "Entrée Kid’s",
        minChoices: 1,
        maxChoices: 1,
      },
      {
        name: "Plat Starter bébé",
        categoryFilter: "Plats Starter Kid",
        minChoices: 1,
        maxChoices: 1,
      },
      { name: "Boisson", categoryFilter: "Boissons", minChoices: 1, maxChoices: 1 },
    ],
  },
];

const REQUIRED_ITEMS = [
  // Choix entrée du menu Asian Kid's (catégorie dédiée, masquée sur la carte)
  { name: "2 Nems poulet", category: "Entrée Kid’s", priceCents: 0, position: 1 },
  { name: "2 Yakitoris poulet", category: "Entrée Kid’s", priceCents: 0, position: 2 },
  // Plats starter bébé du menu Asian Kid's (catégorie dédiée, masquée sur la carte)
  { name: "Nouilles sautées légumes (bébé)", category: "Plats Starter Kid", priceCents: 0, position: 1 },
  { name: "Kao Pad Thaï légumes (bébé)", category: "Plats Starter Kid", priceCents: 0, position: 2 },
  { name: "Riz cantonais (bébé)", category: "Plats Starter Kid", priceCents: 0, position: 3 },
  // Anciens articles Kid conservés (n'apparaissent plus dans le menu, sans effet de bord)
  { name: "Compote", category: "Desserts Kid", priceCents: 0, position: 1 },
  { name: "Capri Sun", category: "Boissons Kid", priceCents: 0, position: 1 },
];

const COLD_MENU_DESCRIPTIONS = [
  {
    name: "Asian First",
    description: "6 Californias saumon avocat + 3 Sushis Saumon + 1 Boisson",
  },
  {
    name: "Asian Combo",
    description: "6 Crunch thon cuit avocat + 6 Avocat roll’s burrata + 6 Frits avocat cheese miel + 1 Boisson",
  },
  {
    name: "Asian Meli Melo",
    description: "6 Saumon roll’s cheese + 6 California saumon avocat + 6 Printemps thon cuit avocat + 1 Boisson",
  },
  {
    name: "Asian Avocado",
    description:
      "6 Avocat roll’s burrata + 6 Avocat roll’s saumon fumé cheese + 6 Frits avocat cheese miel + 1 Boisson",
  },
  {
    name: "Asian Mix",
    description:
      "6 California saumon avocat + 6 Saumon roll’s cheese + 2 Yakitoris bœuf fromage + 1 Yakitori boulettes de bœuf + 1 Yakitori poulet + 1 Boisson",
  },
  {
    name: "Asian Frits",
    description:
      "6 Frits avocat cheese miel + 6 Frits saumon avocat boursin + 6 Frits poulet avocat cheddar sauce curry + 1 Boisson",
  },
];

async function ensureMenuItem(prisma, { name, category, priceCents = 0, position = 0 }) {
  const existing = await prisma.menuItem.findFirst({ where: { name } });
  if (existing) {
    const data = {};
    if (existing.category !== category) data.category = category;
    if (existing.priceCents !== priceCents) data.priceCents = priceCents;
    if (existing.position !== position) data.position = position;
    if (existing.available === false) data.available = true;
    if (Object.keys(data).length > 0) {
      await prisma.menuItem.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }
  const created = await prisma.menuItem.create({
    data: {
      name,
      category,
      priceCents,
      position,
      available: true,
    },
  });
  return created.id;
}

async function ensureBaseItems(prisma) {
  for (const item of REQUIRED_ITEMS) {
    await ensureMenuItem(prisma, item);
  }
}

async function ensureColdMenuDescriptions(prisma) {
  for (const def of COLD_MENU_DESCRIPTIONS) {
    const record = await prisma.menuItem.findFirst({
      where: { name: def.name, category: "Menus Froids" },
    });
    if (record && record.description !== def.description) {
      await prisma.menuItem.update({
        where: { id: record.id },
        data: { description: def.description },
      });
    }
  }
}

async function upsertMenu(prisma, def) {
  let menuId;
  let created = false;

  const existing = await prisma.menu.findFirst({
    where: { name: def.name },
    include: { groups: true },
  });

  if (existing) {
    menuId = existing.id;
    await prisma.menu.update({
      where: { id: menuId },
      data: {
        priceCents: def.priceCents,
        active: true,
        position: def.position,
      },
    });
  } else {
    const createdMenu = await prisma.menu.create({
      data: {
        name: def.name,
        priceCents: def.priceCents,
        active: true,
        position: def.position,
      },
    });
    menuId = createdMenu.id;
    created = true;
  }

  const desiredGroups = (Array.isArray(def.groups) ? def.groups : []).map((g, idx) => ({
    name: g.name,
    categoryFilter: g.categoryFilter,
    minChoices: typeof g.minChoices === "number" ? g.minChoices : 1,
    maxChoices: typeof g.maxChoices === "number" ? g.maxChoices : 1,
    position: idx + 1,
  }));

  const existingGroups = await prisma.menuGroup.findMany({ where: { menuId } });
  const seen = new Set();
  let groupsCreated = 0;
  let groupsUpdated = 0;

  for (const desired of desiredGroups) {
    const matchByName = existingGroups.find((g) => !seen.has(g.id) && g.name === desired.name);
    const matchByCategory = existingGroups.find(
      (g) =>
        !seen.has(g.id) &&
        g.categoryFilter === desired.categoryFilter &&
        g.name.startsWith(desired.name.split(" ")[0] ?? "")
    );
    const current = matchByName ?? matchByCategory ?? null;

    if (current) {
      seen.add(current.id);
      await prisma.menuGroup.update({
        where: { id: current.id },
        data: desired,
      });
      groupsUpdated += 1;
    } else {
      await prisma.menuGroup.create({
        data: {
          menuId,
          ...desired,
        },
      });
      groupsCreated += 1;
    }
  }

  for (const g of existingGroups) {
    if (!seen.has(g.id)) {
      await prisma.menuGroup.delete({ where: { id: g.id } });
    }
  }

  const groups = await prisma.menuGroup.findMany({
    where: { menuId },
    orderBy: { position: "asc" },
  });

  return { created, groupsCreated, groupsUpdated, groups };
}

async function seedHotMenus(prisma, { deactivateLegacy = true } = {}) {
  if (!prisma || typeof prisma !== "object") {
    throw new Error("A PrismaClient instance is required");
  }

  let menusCreated = 0;
  let groupsCreated = 0;
  let groupsUpdated = 0;
  const menuSummaries = [];

  await ensureBaseItems(prisma);
  await ensureColdMenuDescriptions(prisma);

  for (const def of HOT_MENU_DEFS) {
    const result = await upsertMenu(prisma, {
      name: def.name,
      priceCents: def.priceCents,
      position: def.position,
      groups: def.groups,
    });
    if (result.created) menusCreated += 1;
    groupsCreated += result.groupsCreated;
    groupsUpdated += result.groupsUpdated;
    menuSummaries.push({
      name: def.name,
      priceCents: def.priceCents,
      position: def.position,
      created: result.created,
      groupsCreated: result.groupsCreated,
      groupsUpdated: result.groupsUpdated,
      groups: result.groups,
    });
  }

  if (deactivateLegacy) {
    const legacyNames = ["Asian Duo", "Asian Mix", "Asian Gourmand"];
    if (legacyNames.length > 0) {
      await prisma.menu.updateMany({
        where: { name: { in: legacyNames } },
        data: { active: false },
      });
    }
  }

  return {
    totalMenus: HOT_MENU_DEFS.length,
    menusCreated,
    groupsCreated,
    groupsUpdated,
    menuSummaries,
  };
}

module.exports = {
  seedHotMenus,
  HOT_MENU_DEFS,
  REQUIRED_ITEMS,
  COLD_MENU_DESCRIPTIONS,
};

if (require.main === module) {
  const prisma = new PrismaClient();
  seedHotMenus(prisma)
    .then((summary) => {
      const totalGroups = summary.groupsCreated + summary.groupsUpdated;
      console.log(
        `✅ Menus chauds importés (${summary.totalMenus} menus, ${totalGroups} groupes synchronisés, ${summary.menusCreated} créés)`
      );
      for (const menu of summary.menuSummaries) {
        const euro = (menu.priceCents / 100).toFixed(2);
        console.log(
          ` - ${menu.name} (${euro}€) • groupes: ${menu.groups.length} (créés: ${menu.groupsCreated}, mis à jour: ${menu.groupsUpdated})`
        );
      }
    })
    .catch((e) => {
      console.error("❌ Import des menus chauds échoué:", e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

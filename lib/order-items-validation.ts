import prisma from "@/lib/prisma";
import { buildColdMenuCartLabel, COLD_DRINK_CART_SEP, isColdMenuItem } from "@/lib/cold-menus";
import { buildKitchenItemLabel } from "@/lib/kitchen-item-label";
import { isMenuItemHiddenFromCustomers } from "@/lib/menu-item-visibility";

const COMPOSED_SEP_UNICODE = " — ";
const COMPOSED_SEP_ASCII = " - ";
const COLD_DRINK_SEP_LEGACY = " — Boisson: ";

export type IncomingOrderLine = {
  name: string;
  qty: number;
  personId?: string | null;
};

export type ValidatedOrderLine = {
  name: string;
  qty: number;
  price: number;
  personId?: string | null;
};

type CatalogItem = {
  name: string;
  priceCents: number;
  category: string;
  available: boolean;
  hideWhenUnavailable: boolean;
};

export type OrderCatalog = {
  itemsByNorm: Map<string, CatalogItem>;
  allItems: CatalogItem[];
  menus: CatalogMenu[];
};

type CatalogMenu = {
  name: string;
  priceCents: number;
  active: boolean;
};

function normName(value: string): string {
  return value.trim().toLowerCase();
}

function isOrderableItem(item: CatalogItem): boolean {
  if (item.available === false) return false;
  if (isMenuItemHiddenFromCustomers(item)) return false;
  return true;
}

export async function loadOrderCatalog(): Promise<OrderCatalog> {
  const [menuItems, menus] = await Promise.all([
    prisma.menuItem.findMany({
      select: {
        name: true,
        priceCents: true,
        category: true,
        available: true,
        hideWhenUnavailable: true,
      },
    }),
    prisma.menu.findMany({
      select: { name: true, priceCents: true, active: true },
    }),
  ]);

  const itemsByNorm = new Map<string, CatalogItem>();
  const allItems: CatalogItem[] = [];
  for (const it of menuItems) {
    const row: CatalogItem = {
      name: it.name,
      priceCents: it.priceCents,
      category: it.category,
      available: it.available,
      hideWhenUnavailable: it.hideWhenUnavailable,
    };
    allItems.push(row);
    itemsByNorm.set(normName(it.name), row);
  }

  return {
    itemsByNorm,
    allItems,
    menus: menus.map((m) => ({ name: m.name, priceCents: m.priceCents, active: m.active })),
  };
}

function resolveComposedMenu(name: string, catalog: OrderCatalog): { price: number } | null {
  let best: CatalogMenu | null = null;
  for (const menu of catalog.menus) {
    if (!menu.active) continue;
    const withUnicode = name.startsWith(`${menu.name}${COMPOSED_SEP_UNICODE}`);
    const withAscii = name.startsWith(`${menu.name}${COMPOSED_SEP_ASCII}`);
    if (name === menu.name || withUnicode || withAscii) {
      if (!best || menu.name.length > best.name.length) best = menu;
    }
  }
  if (!best) return null;
  return { price: best.priceCents };
}

function findColdDrinkSeparator(name: string): { index: number; length: number } | null {
  for (const sep of [COLD_DRINK_CART_SEP, COLD_DRINK_SEP_LEGACY]) {
    const index = name.indexOf(sep);
    if (index >= 0) return { index, length: sep.length };
  }
  return null;
}

function resolveColdMenu(name: string, catalog: OrderCatalog): { price: number } | null {
  const sep = findColdDrinkSeparator(name);
  if (!sep) return null;
  const menuPart = name.slice(0, sep.index).trim();
  const drinkPart = name.slice(sep.index + sep.length).trim();
  const menuItem = catalog.itemsByNorm.get(normName(menuPart));
  const drinkItem = catalog.itemsByNorm.get(normName(drinkPart));
  if (!menuItem || !drinkItem || !isColdMenuItem(menuItem)) return null;
  if (!isOrderableItem(menuItem) || !isOrderableItem(drinkItem)) return null;
  const expected = buildColdMenuCartLabel(menuItem.name, drinkItem.name);
  if (normName(expected) !== normName(name)) {
    // Ancien libellé avec tiret unicode (accepté si contenu identique)
    const legacyExpected = `${menuItem.name}${COLD_DRINK_SEP_LEGACY}${drinkItem.name}`;
    if (normName(legacyExpected) !== normName(name)) return null;
  }
  return { price: menuItem.priceCents };
}

function resolveLine(name: string, catalog: OrderCatalog): { price: number } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const cold = resolveColdMenu(trimmed, catalog);
  if (cold) return cold;

  const composed = resolveComposedMenu(trimmed, catalog);
  if (composed) return composed;

  for (const item of catalog.allItems) {
    const kitchenLabel = buildKitchenItemLabel(item.category, item.name);
    if (normName(trimmed) === normName(kitchenLabel)) {
      if (!isOrderableItem(item)) return null;
      return { price: item.priceCents };
    }
  }

  const item = catalog.itemsByNorm.get(normName(trimmed));
  if (!item || !isOrderableItem(item)) return null;
  return { price: item.priceCents };
}

export async function validateAndResolveOrderItems(
  rawItems: IncomingOrderLine[]
): Promise<
  | { ok: true; items: ValidatedOrderLine[]; total: number }
  | { ok: false; code: string; message: string }
> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, code: "EMPTY_CART", message: "Panier vide" };
  }

  const catalog = await loadOrderCatalog();
  const validated: ValidatedOrderLine[] = [];

  for (const raw of rawItems) {
    const name = String(raw?.name ?? "").trim();
    const qty = Math.round(Number(raw?.qty ?? 0));
    if (!name || !Number.isFinite(qty) || qty < 1) {
      return { ok: false, code: "INVALID_ITEM", message: "Article invalide dans le panier" };
    }

    const resolved = resolveLine(name, catalog);
    if (!resolved) {
      return {
        ok: false,
        code: "UNKNOWN_OR_UNAVAILABLE",
        message: `Article indisponible ou inconnu : « ${name} »`,
      };
    }

    validated.push({
      name,
      qty,
      price: resolved.price,
      personId:
        raw.personId == null || String(raw.personId).trim() === ""
          ? null
          : String(raw.personId).trim(),
    });
  }

  const total = validated.reduce((sum, it) => sum + it.price * it.qty, 0);
  return { ok: true, items: validated, total };
}

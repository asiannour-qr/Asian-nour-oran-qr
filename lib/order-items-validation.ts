import prisma from "@/lib/prisma";
import { buildColdMenuCartLabel, isColdMenuItem } from "@/lib/cold-menus";
import { isMenuItemHiddenFromCustomers } from "@/lib/menu-item-visibility";

const COMPOSED_SEP = " — ";
const COLD_DRINK_SEP = " — Boisson: ";

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

type CatalogMenu = {
  name: string;
  priceCents: number;
  active: boolean;
};

type OrderCatalog = {
  itemsByNorm: Map<string, CatalogItem>;
  menus: CatalogMenu[];
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
  for (const it of menuItems) {
    itemsByNorm.set(normName(it.name), {
      name: it.name,
      priceCents: it.priceCents,
      category: it.category,
      available: it.available,
      hideWhenUnavailable: it.hideWhenUnavailable,
    });
  }

  return {
    itemsByNorm,
    menus: menus.map((m) => ({ name: m.name, priceCents: m.priceCents, active: m.active })),
  };
}

function resolveComposedMenu(name: string, catalog: OrderCatalog): { price: number } | null {
  let best: CatalogMenu | null = null;
  for (const menu of catalog.menus) {
    if (!menu.active) continue;
    if (name === menu.name || name.startsWith(`${menu.name}${COMPOSED_SEP}`)) {
      if (!best || menu.name.length > best.name.length) best = menu;
    }
  }
  if (!best) return null;
  return { price: best.priceCents };
}

function resolveColdMenu(name: string, catalog: OrderCatalog): { price: number } | null {
  const idx = name.indexOf(COLD_DRINK_SEP);
  if (idx < 0) return null;
  const menuPart = name.slice(0, idx).trim();
  const drinkPart = name.slice(idx + COLD_DRINK_SEP.length).trim();
  const menuItem = catalog.itemsByNorm.get(normName(menuPart));
  const drinkItem = catalog.itemsByNorm.get(normName(drinkPart));
  if (!menuItem || !drinkItem || !isColdMenuItem(menuItem)) return null;
  if (!isOrderableItem(menuItem) || !isOrderableItem(drinkItem)) return null;
  const expected = buildColdMenuCartLabel(menuItem.name, drinkItem.name);
  if (normName(expected) !== normName(name)) return null;
  return { price: menuItem.priceCents };
}

function resolveLine(name: string, catalog: OrderCatalog): { price: number } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const cold = resolveColdMenu(trimmed, catalog);
  if (cold) return cold;

  const composed = resolveComposedMenu(trimmed, catalog);
  if (composed) return composed;

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

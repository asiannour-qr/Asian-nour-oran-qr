import type { OrderCatalog } from "@/lib/order-items-validation";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Préfixe cuisine pour les catégories à variantes courtes
 * (Californias → California, Saumon Roll's → Saumon roll, etc.).
 */
export function kitchenCategoryPrefix(category: string): string | null {
  const c = category.trim().toLowerCase();
  if (!c) return null;

  const rules: Array<[RegExp, string]> = [
    [/california/, "California"],
    [/saumon roll/, "Saumon roll"],
    [/avocat roll/, "Avocat roll"],
    [/^makis?\b/, "Maki"],
    [/crunch/, "Crunch"],
    [/flocon/, "Flocon"],
    [/^frits?\b/, "Frit"],
    [/printemps/, "Printemps"],
    [/les originaux/, "Original"],
    [/^sushis?\b/, "Sushi"],
    [/yakitori/, "Yakitori"],
    [/chira[sc]hi/, "Chirashi"],
    [/poke/, "Poke"],
  ];

  for (const [pattern, prefix] of rules) {
    if (pattern.test(c)) return prefix;
  }
  return null;
}

/** Libellé ticket cuisine : catégorie + variante (ex. California saumon avocat). */
export function buildKitchenItemLabel(category: string, itemName: string): string {
  const name = itemName.trim();
  if (!name) return category.trim();
  const prefix = kitchenCategoryPrefix(category);
  if (!prefix) return name;
  return `${prefix} ${name}`.replace(/\s+/g, " ").trim();
}

/** Menus composés admin (Asian Classic — Entrée: … • Plat: …), pas les articles California. */
export function isComposedMenuCartLabel(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed.includes(" — ")) return false;
  if (trimmed.includes(" • ")) return true;
  if (/^asian\s/i.test(trimmed)) return true;
  if (/:\s/.test(trimmed)) return true;
  return false;
}

/** Résout un nom stocké en commande vers le libellé cuisine complet. */
export function resolveKitchenItemLabel(storedName: string, catalog: OrderCatalog): string {
  const trimmed = storedName.trim();
  if (!trimmed) return trimmed;

  const storedNorm = norm(trimmed);

  for (const item of catalog.allItems) {
    const kitchen = buildKitchenItemLabel(item.category, item.name);
    if (norm(kitchen) === storedNorm) return kitchen;
  }

  const exactMatches = catalog.allItems.filter((item) => norm(item.name) === storedNorm);
  if (exactMatches.length === 1) {
    return buildKitchenItemLabel(exactMatches[0].category, exactMatches[0].name);
  }

  return trimmed;
}

export function enrichItemsForKitchenTicket<
  T extends { name: string; qty: number; price?: number | null; personId?: string | null },
>(items: T[], catalog: OrderCatalog): T[] {
  return items.map((item) => ({
    ...item,
    name: resolveKitchenItemLabel(item.name, catalog),
  }));
}

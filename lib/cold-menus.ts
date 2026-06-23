export const COLD_MENU_CATEGORY = "Menus Froids";
export const DRINK_CATEGORY = "Boissons";

export type ColdMenuItem = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  description?: string | null;
  available?: boolean;
};

export function isColdMenuItem(item: Pick<ColdMenuItem, "category">) {
  return (item.category || "").trim() === COLD_MENU_CATEGORY;
}

export function filterDrinkOptions<
  T extends { category: string; name?: string; position?: number; available?: boolean },
>(menuItems: T[]): T[] {
  return menuItems
    .filter((it) => (it.category || "").trim() === DRINK_CATEGORY && it.available !== false)
    .sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      return (a.name || "").localeCompare(b.name || "", "fr");
    });
}

/** Séparateur ASCII — évite les « ? » sur imprimantes ESC/POS. */
export const COLD_DRINK_CART_SEP = " - Boisson: ";

export function buildColdMenuCartLabel(menuName: string, drinkName: string) {
  return `${menuName}${COLD_DRINK_CART_SEP}${drinkName}`;
}

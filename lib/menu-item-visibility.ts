/** Article retiré de la carte client (indisponible + masqué). */
export function isMenuItemHiddenFromCustomers(item: {
  available?: boolean | null;
  hideWhenUnavailable?: boolean | null;
}): boolean {
  return item.available === false && item.hideWhenUnavailable === true;
}

export function filterCustomerMenuItems<
  T extends { available?: boolean | null; hideWhenUnavailable?: boolean | null },
>(items: T[]): T[] {
  return items.filter((it) => !isMenuItemHiddenFromCustomers(it));
}

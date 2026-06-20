import { COLD_MENU_CATEGORY } from "@/lib/cold-menus";

export const HOT_MENUS_SECTION_ID = "menus-chauds";
export const COLD_MENUS_SECTION_ID = "menus-froids";

export const HOT_MENUS_SLIDER_LABEL = "Menus chauds";
export const COLD_MENUS_SLIDER_LABEL = "Menus froids";

export function isFormulaMenuCategory(category: string) {
  return (category || "").trim() === COLD_MENU_CATEGORY;
}

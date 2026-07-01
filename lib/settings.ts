import prisma from "@/lib/prisma";
import { SITE_CONFIG } from "@/lib/site";
import { DEFAULT_TABLE_COUNT } from "@/lib/table-count";
import { DEFAULT_CLIENT_SUPPLEMENTS, sanitizeSupplementDefs, type SupplementDef } from "@/lib/supplements";

export const SETTINGS_ID = "default";

/** Pages carte par défaut (accueil / tables) si aucune image admin. */
export const DEFAULT_MENU_CARD_PAGES = SITE_CONFIG.menuCardPages;

/** @deprecated Alias historique Oran — préférer DEFAULT_MENU_CARD_PAGES */
export const ORAN_MENU_CARD_PAGES = DEFAULT_MENU_CARD_PAGES;

/** Image par défaut (1ère page) — fallback legacy. */
export const DEFAULT_MENU_CARD_IMAGE = DEFAULT_MENU_CARD_PAGES[0];

export type DayHours = {
  ouvert: boolean;
  debut: string;
  fin: string;
  /** Service du soir (coupure entre fin et debut2). */
  debut2?: string;
  fin2?: string;
  /** Service continu (ex. 11h–00h). */
  continu?: boolean;
};

export type OpeningHours = Record<string, DayHours>;

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

export const DEFAULT_OPENING_HOURS: OpeningHours = Object.fromEntries(
  JOURS.map((j) => [
    j,
    { ouvert: j !== "dimanche", debut: "11:30", fin: "22:00" },
  ])
);

export type Settings = {
  restaurantName: string;
  address: string | null;
  phone: string | null;
  tableCount: number;
  kitchenSoundEnabled: boolean;
  autoPrintEnabled: boolean;
  openingHours: OpeningHours;
  menuCardImageUrl: string | null;
  clientSupplements: SupplementDef[];
};

export function resolveMenuCardImageUrl(settings?: Pick<Settings, "menuCardImageUrl"> | null): string {
  const url = settings?.menuCardImageUrl?.trim();
  return url || DEFAULT_MENU_CARD_IMAGE;
}

export async function getSettings(): Promise<Settings> {
  const row = await prisma.restaurantSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  return {
    restaurantName: row?.restaurantName ?? "Asian Nour",
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    tableCount: row?.tableCount ?? DEFAULT_TABLE_COUNT,
    kitchenSoundEnabled: row?.kitchenSoundEnabled ?? true,
    autoPrintEnabled: row?.autoPrintEnabled ?? false,
    openingHours:
      (row?.openingHours as OpeningHours | null) ?? DEFAULT_OPENING_HOURS,
    menuCardImageUrl: row?.menuCardImageUrl ?? null,
    clientSupplements:
      row?.clientSupplements != null
        ? sanitizeSupplementDefs(row.clientSupplements)
        : DEFAULT_CLIENT_SUPPLEMENTS,
  };
}

export async function upsertSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged = { ...current, ...patch };

  await prisma.restaurantSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      restaurantName: merged.restaurantName,
      address: merged.address,
      phone: merged.phone,
      tableCount: merged.tableCount,
      kitchenSoundEnabled: merged.kitchenSoundEnabled,
      autoPrintEnabled: merged.autoPrintEnabled,
      openingHours: merged.openingHours as object,
      menuCardImageUrl: merged.menuCardImageUrl,
      clientSupplements: merged.clientSupplements as object,
    },
    update: {
      restaurantName: merged.restaurantName,
      address: merged.address,
      phone: merged.phone,
      tableCount: merged.tableCount,
      kitchenSoundEnabled: merged.kitchenSoundEnabled,
      autoPrintEnabled: merged.autoPrintEnabled,
      openingHours: merged.openingHours as object,
      menuCardImageUrl: merged.menuCardImageUrl,
      clientSupplements: merged.clientSupplements as object,
    },
  });

  return merged;
}

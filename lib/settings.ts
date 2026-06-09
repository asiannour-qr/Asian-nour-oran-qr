import prisma from "@/lib/prisma";

export const SETTINGS_ID = "default";

export type DayHours = {
  ouvert: boolean;
  debut: string;
  fin: string;
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
};

export async function getSettings(): Promise<Settings> {
  const row = await prisma.restaurantSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  return {
    restaurantName: row?.restaurantName ?? "Asian Nour",
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    tableCount: row?.tableCount ?? 15,
    kitchenSoundEnabled: row?.kitchenSoundEnabled ?? true,
    autoPrintEnabled: row?.autoPrintEnabled ?? false,
    openingHours:
      (row?.openingHours as OpeningHours | null) ?? DEFAULT_OPENING_HOURS,
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
    },
    update: {
      restaurantName: merged.restaurantName,
      address: merged.address,
      phone: merged.phone,
      tableCount: merged.tableCount,
      kitchenSoundEnabled: merged.kitchenSoundEnabled,
      autoPrintEnabled: merged.autoPrintEnabled,
      openingHours: merged.openingHours as object,
    },
  });

  return merged;
}

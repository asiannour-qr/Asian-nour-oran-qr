/** Configuration propre à chaque instance (Oran / Tours / Fleury). */
export type SiteCurrency = "DZD" | "EUR";

export type SitePrinterProfile = {
  model: string;
  paperWidthMm: number;
  lineWidth: number;
  defaultPort: number;
  protocol: "ESC/POS";
};

export const SITE_CONFIG = {
  currency: "DZD" as SiteCurrency,
  currencyLocale: "fr-DZ" as const,
  timeZone: "Africa/Algiers" as const,
  menuCardPages: [
    "/carte/asian-nour/carte-oran-01-wok.jpg",
    "/carte/asian-nour/carte-oran-02-japonaise.jpg",
    "/carte/asian-nour/carte-oran-03-specialites.jpg",
  ] as const,
  settingsPlaceholders: {
    address: "12 Bd de l'ALN, Oran",
    phone: "+213 41 XX XX XX",
  },
  /** Xprinter XP-260M (80 mm) — Oran. */
  printerProfile: {
    model: "Xprinter XP-260M",
    paperWidthMm: 80,
    lineWidth: 32,
    defaultPort: 9100,
    protocol: "ESC/POS",
  } satisfies SitePrinterProfile,
} as const;

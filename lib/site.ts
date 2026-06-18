/** Configuration propre à chaque instance (Oran / Tours / Fleury). */
export type SiteCurrency = "DZD" | "EUR";

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
} as const;

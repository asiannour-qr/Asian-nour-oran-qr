import { SITE_CONFIG } from "@/lib/site";

export function formatMoney(cents: number): string {
  const value = Number.isFinite(cents) ? cents : 0;
  if (SITE_CONFIG.currency === "DZD") {
    return `${Math.round(value / 100)} DZD`;
  }
  return new Intl.NumberFormat(SITE_CONFIG.currencyLocale, {
    style: "currency",
    currency: SITE_CONFIG.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function priceInputLabel(): string {
  return SITE_CONFIG.currency === "EUR" ? "Prix (€)" : "Prix (DZD)";
}

export function currencyCode(): string {
  return SITE_CONFIG.currency;
}

export function currencySuffix(): string {
  return SITE_CONFIG.currency === "EUR" ? "€" : SITE_CONFIG.currency;
}

export function formatMoneyInputValue(cents: number): string {
  const value = Number.isFinite(cents) ? cents : 0;
  if (SITE_CONFIG.currency === "EUR") {
    return new Intl.NumberFormat(SITE_CONFIG.currencyLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  return String(Math.round(value / 100));
}

export function csvRevenueHeaders(): { total: string; dineIn: string; takeaway: string } {
  const code = currencyCode();
  return {
    total: `CA total (${code})`,
    dineIn: `Sur place (${code})`,
    takeaway: `A emporter (${code})`,
  };
}

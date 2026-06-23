export const KITCHEN_PRINTER_ID = "kitchen";
export const CUSTOMER_PRINTER_ID = "customer";
export const EXTRA_PRINTER_ID = "extra";
/** @deprecated Ancien identifiant unique — migré vers `kitchen` */
export const LEGACY_PRINTER_ID = "default";
export const DEFAULT_PRINTER_PORT = 9100;

export type PrinterTarget = "kitchen" | "customer" | "extra";

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function isValidPrinterIp(ip: string): boolean {
  return IPV4_REGEX.test(ip.trim());
}

export function parsePrinterPort(value: unknown): number | null {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

export function normalizePrinterIp(ip: unknown): string | null {
  if (typeof ip !== "string") return null;
  const trimmed = ip.trim();
  if (!trimmed || !isValidPrinterIp(trimmed)) return null;
  return trimmed;
}

export function targetForVariant(variant: "kitchen" | "customer"): PrinterTarget {
  return variant === "customer" ? "customer" : "kitchen";
}

export function printerIdForTarget(target: PrinterTarget): string {
  if (target === "customer") return CUSTOMER_PRINTER_ID;
  if (target === "extra") return EXTRA_PRINTER_ID;
  return KITCHEN_PRINTER_ID;
}

export function parsePrinterRole(value: unknown): PrinterTarget | null {
  if (value === "kitchen" || value === "customer" || value === "extra") return value;
  return null;
}

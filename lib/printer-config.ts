export const PRINTER_CONFIG_ID = "default";
export const DEFAULT_PRINTER_PORT = 9100;

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

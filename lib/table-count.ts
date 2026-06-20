export const DEFAULT_TABLE_COUNT = 25;
export const MIN_TABLE_COUNT = 1;
export const MAX_TABLE_COUNT = 500;

export function clampTableCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_TABLE_COUNT;
  return Math.max(MIN_TABLE_COUNT, Math.min(MAX_TABLE_COUNT, n));
}

export function resolveTableCount(value: unknown): number {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return clampTableCount(n);
  return DEFAULT_TABLE_COUNT;
}

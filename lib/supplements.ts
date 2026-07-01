export type SupplementDef = { label: string; priceCents: number };

/** Suppléments client par défaut (Oran) si rien n'est configuré. Montants en centimes. */
export const DEFAULT_CLIENT_SUPPLEMENTS: SupplementDef[] = [
  { label: "Supplément poulet", priceCents: 25000 }, // 250 DZD
  { label: "Supplément crevettes", priceCents: 45000 }, // 450 DZD
  { label: "Supplément bœuf", priceCents: 45000 }, // 450 DZD
];

/** Catégories qui ne peuvent PAS recevoir de supplément. */
const EXCLUDED_CATEGORY_KEYWORDS = ["boisson", "dessert"];

export function isSupplementableCategory(category: string | null | undefined): boolean {
  const c = (category ?? "").toLowerCase();
  if (!c) return true;
  return !EXCLUDED_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

const MAX_SUPPLEMENTS_PER_LINE = 6;
const MAX_LABEL_LEN = 60;
const MAX_PRICE_CENTS = 5_000_00; // garde-fou (5000 unités)

function normLabel(s: string): string {
  return s.trim().toLowerCase();
}

/** Nettoie des suppléments libres (mode serveur) : intitulé requis, montant entier ≥ 0. */
export function sanitizeStaffSupplements(input: unknown): SupplementDef[] {
  if (!Array.isArray(input)) return [];
  const out: SupplementDef[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const label = String((raw as { label?: unknown }).label ?? "").trim().slice(0, MAX_LABEL_LEN);
    let price = Math.round(Number((raw as { priceCents?: unknown }).priceCents ?? 0));
    if (!label) continue;
    if (!Number.isFinite(price) || price < 0) price = 0;
    if (price > MAX_PRICE_CENTS) price = MAX_PRICE_CENTS;
    out.push({ label, priceCents: price });
    if (out.length >= MAX_SUPPLEMENTS_PER_LINE) break;
  }
  return out;
}

/**
 * Valide des suppléments client contre la liste autorisée (intitulé + montant doivent
 * correspondre exactement). Renvoie la liste normalisée, ou null si un supplément
 * n'est pas autorisé.
 */
export function matchClientSupplements(
  input: unknown,
  allowed: SupplementDef[]
): SupplementDef[] | null {
  if (input == null) return [];
  if (!Array.isArray(input)) return null;
  if (input.length === 0) return [];
  if (input.length > MAX_SUPPLEMENTS_PER_LINE) return null;

  const out: SupplementDef[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const label = String((raw as { label?: unknown }).label ?? "").trim();
    const price = Math.round(Number((raw as { priceCents?: unknown }).priceCents ?? NaN));
    const found = allowed.find(
      (a) => normLabel(a.label) === normLabel(label) && a.priceCents === price
    );
    if (!found) return null;
    out.push({ label: found.label, priceCents: found.priceCents });
  }
  return out;
}

export function supplementsTotalCents(list: SupplementDef[] | null | undefined): number {
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, x) => s + (Number(x.priceCents) || 0), 0);
}

/** Nettoie une liste de suppléments configurés (admin). */
export function sanitizeSupplementDefs(input: unknown): SupplementDef[] {
  return sanitizeStaffSupplements(input).filter((s) => s.label.length > 0);
}

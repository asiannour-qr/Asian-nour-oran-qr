/**
 * URL de base publique pour les QR codes, robuste aux variables mal configurées.
 * - Côté navigateur : on utilise toujours le domaine réel (window.location.origin),
 *   ce qui garantit un QR valide même si NEXT_PUBLIC_BASE_URL est absent ou malformé.
 * - NEXT_PUBLIC_BASE_URL ne sert que de secours hors navigateur, avec normalisation
 *   du schéma (ajout de https:// si manquant) et suppression du slash final.
 */
export function getPublicBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

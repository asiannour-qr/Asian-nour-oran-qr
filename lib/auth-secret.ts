/**
 * Secret utilisé pour signer les jetons de session (HMAC).
 * Priorité à AUTH_SECRET ; sinon dérive des secrets existants
 * pour fonctionner sans nouvelle variable d'environnement.
 * Compatible Edge (aucun import Node).
 */
export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    "asian-nour-dev-secret"
  );
}

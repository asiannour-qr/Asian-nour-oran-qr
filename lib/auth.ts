export function getAdminCreds() {
    const user = (process.env.ADMIN_USER ?? "").trim();
    const rawPass = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASS ?? "";
    const pass = rawPass.trim();
    return { user, pass };
}

export function isAdminConfigured(): boolean {
    const { user, pass } = getAdminCreds();
    return Boolean(user && pass);
}

export const ADMIN_SESSION_COOKIE = "adminSession";

/** durée (en ms) d'une session admin */
export const ADMIN_SESSION_TTL = 1000 * 60 * 60 * 12; // 12h

export function createSessionValue(): string {
    // valeur simple, pas de JWT ici. Suffit pour protéger l’admin.
    // On pourrait mettre un random + horodatage.
    return `ok:${Date.now()}`;
}

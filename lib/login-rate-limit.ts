// Limiteur de tentatives de connexion en mémoire (par IP + portée).
// Suffisant pour freiner la force brute ; remis à zéro au redémarrage du process.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type Bucket = { count: number; firstAttemptAt: number };

const buckets = new Map<string, Bucket>();

function keyFor(scope: string, ip: string) {
  return `${scope}:${ip}`;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Renvoie le nombre de secondes à attendre, ou 0 si la tentative est autorisée. */
export function checkLoginAllowed(scope: string, ip: string): number {
  const bucket = buckets.get(keyFor(scope, ip));
  if (!bucket) return 0;
  const elapsed = Date.now() - bucket.firstAttemptAt;
  if (elapsed > WINDOW_MS) {
    buckets.delete(keyFor(scope, ip));
    return 0;
  }
  if (bucket.count < MAX_ATTEMPTS) return 0;
  return Math.ceil((WINDOW_MS - elapsed) / 1000);
}

export function recordFailedLogin(scope: string, ip: string) {
  const key = keyFor(scope, ip);
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return;
  }
  bucket.count += 1;
}

export function clearLoginAttempts(scope: string, ip: string) {
  buckets.delete(keyFor(scope, ip));
}

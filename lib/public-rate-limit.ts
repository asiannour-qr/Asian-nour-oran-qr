import { checkLoginAllowed, getClientIp, recordFailedLogin } from "@/lib/login-rate-limit";

const SCOPES = {
  "order-submit": { maxAttempts: 12, windowMs: 10 * 60 * 1000 },
} as const;

type Scope = keyof typeof SCOPES;

/** Rate-limit léger pour endpoints publics sensibles (soumission commande). */
export function checkPublicActionAllowed(scope: Scope, ip: string): number {
  return checkLoginAllowed(scope, ip);
}

export function recordPublicAction(scope: Scope, ip: string): void {
  recordFailedLogin(scope, ip);
}

export { getClientIp };

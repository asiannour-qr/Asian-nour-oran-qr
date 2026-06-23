"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function KitchenLoginForm() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/kitchen";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username.trim(), pass: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Identifiants invalides");
      } else {
        const { primeOrderAlertAudio } = await import("@/lib/order-audio-context");
        await primeOrderAlertAudio();
        // Safari iOS : navigation complète pour que le cookie de session soit appliqué
        // avant le chargement de /serveur ou /kitchen (router.replace peut échouer).
        const target = next.startsWith("/") ? next : "/kitchen";
        window.location.assign(target);
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  const inputShell =
    "flex items-center gap-3 w-full rounded-2xl border border-[rgba(120,110,98,0.22)] bg-white/90 px-4 py-3 shadow-[inset_0_1px_2px_rgba(61,47,33,0.04)] transition focus-within:border-[rgba(190,127,57,0.55)] focus-within:ring-2 focus-within:ring-[rgba(190,127,57,0.18)]";
  const inputField =
    "flex-1 min-w-0 bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none text-base";

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-[420px] space-y-8">
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-2xl bg-black overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.28)] px-2 mx-auto inline-block">
            <Image src="/logo-header.png" alt="Asian Nour" width={440} height={220} priority className="h-24 sm:h-28 w-auto" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-[var(--color-heading)]">
              Espace cuisine
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Connectez-vous pour accéder à l&apos;écran des commandes.
            </p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className="surface-card-strong rounded-[1.75rem] border border-[rgba(190,127,57,0.22)] px-5 py-7 sm:px-8 sm:py-9 shadow-[var(--shadow-soft)] space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-heading)]" htmlFor="kitchen-username">
              Identifiant
            </label>
            <div className={inputShell}>
              <input
                id="kitchen-username"
                name="username"
                type="text"
                className={inputField}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-heading)]" htmlFor="kitchen-password">
              Mot de passe
            </label>
            <div className={inputShell}>
              <input
                id="kitchen-password"
                name="password"
                className={inputField}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-strong)] transition"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">
            {submitting ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Identifiants oubliés ? Demandez à l&apos;administrateur.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function KitchenLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center text-[var(--color-text-muted)]">
          Chargement…
        </div>
      }
    >
      <KitchenLoginForm />
    </Suspense>
  );
}

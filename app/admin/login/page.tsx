"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 19.5c.9-3.2 3.4-5 6.5-5s5.6 1.8 6.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12s3.5-6 9-6c2.1 0 3.9.8 5.3 1.9M21 12s-3.5 6-9 6c-2.1 0-3.9-.8-5.3-1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin/qr";

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
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username.trim(), pass: password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Identifiants invalides");
      } else {
        router.replace(next);
        router.refresh();
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
            <Image
              src="/logo-header.png"
              alt="Asian Nour"
              width={440}
              height={220}
              priority
              className="h-24 sm:h-28 w-auto"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-[var(--color-heading)]">
              Espace administration
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Connectez-vous pour accéder au back-office.
            </p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className="surface-card-strong rounded-[1.75rem] border border-[rgba(190,127,57,0.22)] px-5 py-7 sm:px-8 sm:py-9 shadow-[var(--shadow-soft)] space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-heading)]" htmlFor="admin-username">
              Identifiant
            </label>
            <div className={inputShell}>
              <span className="text-[var(--color-text-muted)] shrink-0">
                <UserIcon />
              </span>
              <input
                id="admin-username"
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
            <label className="text-sm font-medium text-[var(--color-heading)]" htmlFor="admin-password">
              Mot de passe
            </label>
            <div className={inputShell}>
              <input
                id="admin-password"
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
                className="shrink-0 rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-strong)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(190,127,57,0.45)]"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <EyeIcon open={showPassword} />
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
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center text-[var(--color-text-muted)]">
          Chargement…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

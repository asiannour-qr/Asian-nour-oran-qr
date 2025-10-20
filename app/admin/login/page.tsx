"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const next = sp.get("next") || "/admin/qr";

    const [username, setUsername] = useState("asian");
    const [password, setPassword] = useState("nour123!");
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
                body: JSON.stringify({ user: username, pass: password }),
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
            <form onSubmit={onSubmit} className="w-full max-w-sm bg-white shadow-lg rounded-xl p-6 space-y-4">
                <h1 className="text-xl font-semibold">Connexion Admin</h1>

                <div className="space-y-1">
                    <label className="text-sm text-neutral-600" htmlFor="admin-username">
                        Nom d’utilisateur
                    </label>
                    <input
                        id="admin-username"
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ADMIN_USER"
                        autoComplete="username"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-neutral-600" htmlFor="admin-password">
                        Mot de passe
                    </label>
                    <input
                        id="admin-password"
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="ADMIN_PASSWORD"
                        autoComplete="current-password"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    disabled={submitting}
                    className="w-full rounded-lg bg-black text-white py-2 disabled:opacity-50"
                >
                    {submitting ? "Connexion…" : "Se connecter"}
                </button>

                <p className="text-xs text-neutral-500">
                    Accès réservé. Identifiants définis dans <code>.env</code>.
                </p>
            </form>
        </div>
    );
}

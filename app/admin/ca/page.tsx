"use client";

import { useCallback, useEffect, useState } from "react";
import RevenueHistoryTable from "./RevenueHistoryTable";

type RevenueResponse = {
    todayDateLabel: string;
    todayTotal: number;
    todayDineIn: number;
    todayTakeaway: number;
    todayCount: number;
    history: { dateLabel: string; total: number; dineIn: number; takeaway: number; count: number }[];
    topProducts: { name: string; qty: number; revenue: number }[];
};

const POLL_INTERVAL_MS = 5000;

export default function AdminRevenuePage() {
    const [data, setData] = useState<RevenueResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchRevenue = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/ca", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = (await res.json()) as RevenueResponse;
            setData(payload);
            setError(null);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error("[admin/ca] fetch error", err);
            setError("Impossible de récupérer les données.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRevenue();
        const id = setInterval(fetchRevenue, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchRevenue]);

    const formatEuro = useCallback((cents: number) => {
        const dzdFormatter = new Intl.NumberFormat("fr-DZ", {
            maximumFractionDigits: 0,
        });
        return `${dzdFormatter.format(Math.round((cents ?? 0) / 100))} DZD`;
    }, []);

    return (
        <div className="space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold text-[var(--color-heading)]">Chiffre d’affaires</h1>
                    <p className="surface-muted-text text-sm">
                        Suivi en temps réel (commandes annulées exclues). Rafraîchi toutes les 5 secondes.
                    </p>
                </div>
                <a
                    href="/api/admin/ca?format=csv"
                    download
                    className="px-4 py-2 rounded-lg border border-[var(--color-border,#d8cbb8)] bg-white text-sm font-medium text-[var(--color-heading)] hover:bg-black/5 transition"
                >
                    ⬇ Exporter en CSV (30 jours)
                </a>
            </header>

            <section className="rounded-3xl border border-[rgba(190,127,57,0.28)] bg-[rgba(255,252,247,0.92)] p-6 shadow-[0_25px_60px_rgba(61,47,33,0.12)] space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-heading)]">CA ACTUALISÉ</p>
                        <h2 className="text-2xl font-semibold text-[var(--color-heading)]">
                            {data ? `du ${data.todayDateLabel}` : "Chargement…"}
                        </h2>
                    </div>
                    {lastUpdated && (
                        <span className="text-xs surface-muted-text">
                            Maj {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" })}
                        </span>
                    )}
                </div>
                <div className="text-5xl font-semibold text-[var(--color-accent-strong)]">
                    {loading ? (
                        <span className="text-4xl text-[var(--color-heading)]">…</span>
                    ) : (
                        formatEuro(data?.todayTotal ?? 0)
                    )}
                </div>
                {data && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.25em] surface-muted-text">🍽 Sur place</p>
                            <p className="text-xl font-semibold text-[var(--color-heading)]">{formatEuro(data.todayDineIn)}</p>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.25em] surface-muted-text">🥡 À emporter</p>
                            <p className="text-xl font-semibold text-[var(--color-heading)]">{formatEuro(data.todayTakeaway)}</p>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.25em] surface-muted-text">🧾 Commandes</p>
                            <p className="text-xl font-semibold text-[var(--color-heading)]">{data.todayCount}</p>
                        </div>
                    </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </section>

            <section className="space-y-4">
                <div>
                    <h3 className="text-xl font-semibold text-[var(--color-heading)]">Top plats (30 jours)</h3>
                    <p className="surface-muted-text text-sm">Les plats les plus commandés — utile pour gérer la carte et les stocks.</p>
                </div>
                {loading && !data ? (
                    <div className="surface-muted-text text-sm">Chargement…</div>
                ) : !data?.topProducts?.length ? (
                    <div className="surface-muted-text text-sm">Aucune vente sur la période.</div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-[rgba(245,239,230,0.65)] text-xs uppercase tracking-[0.25em] text-[var(--color-heading)] px-4 py-3">
                            <span>Plat</span>
                            <span className="text-right">Qté</span>
                            <span className="text-right">CA</span>
                        </div>
                        <ul className="divide-y divide-black/5">
                            {data.topProducts.map((p, i) => (
                                <li key={p.name} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 text-sm items-center">
                                    <span className="font-medium">
                                        <span className="inline-block w-7 text-xs surface-muted-text">{i + 1}.</span>
                                        {p.name}
                                    </span>
                                    <span className="text-right font-semibold">{p.qty}</span>
                                    <span className="text-right surface-muted-text">{formatEuro(p.revenue)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div>
                    <h3 className="text-xl font-semibold text-[var(--color-heading)]">Historique quotidien</h3>
                    <p className="surface-muted-text text-sm">Derniers jours enregistrés (max 30 jours).</p>
                </div>
                {loading && !data ? (
                    <div className="surface-muted-text text-sm">Chargement…</div>
                ) : (
                    <RevenueHistoryTable history={data?.history ?? []} formatEuro={formatEuro} />
                )}
            </section>
        </div>
    );
}

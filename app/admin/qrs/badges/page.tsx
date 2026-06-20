// app/admin/qrs/badges/page.tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { generateTableQrCodes } from "@/lib/generate-table-qrs";
import {
  DEFAULT_TABLE_COUNT,
  MAX_TABLE_COUNT,
  MIN_TABLE_COUNT,
  clampTableCount,
  resolveTableCount,
} from "@/lib/table-count";

type QR = { table: number; dataUrl: string };

export default function BadgeQRCodesPage() {
    const [count, setCount] = useState(DEFAULT_TABLE_COUNT);
    const [draftCount, setDraftCount] = useState(String(DEFAULT_TABLE_COUNT));
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(false);
    const [codes, setCodes] = useState<QR[]>([]);
    const [restaurantName, setRestaurantName] = useState("Asian Nour");
    const [widthMm, setWidthMm] = useState(85);
    const [heightMm, setHeightMm] = useState(55);
    const [logoEmoji, setLogoEmoji] = useState("🍜");

    const baseUrl = useMemo(() => getPublicBaseUrl(), []);

    const generate = useCallback(async () => {
        if (!baseUrl) return;
        setBusy(true);
        try {
            const arr = await generateTableQrCodes(baseUrl, count, { scale: 6 });
            setCodes(arr);
        } finally {
            setBusy(false);
        }
    }, [baseUrl, count]);

    useEffect(() => {
        fetch("/api/settings", { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                const n = resolveTableCount(data?.tableCount);
                setCount(n);
                setDraftCount(String(n));
            })
            .catch(() => {
                setCount(DEFAULT_TABLE_COUNT);
                setDraftCount(String(DEFAULT_TABLE_COUNT));
            });
    }, []);

    async function saveTableCount(next: number) {
        const applied = clampTableCount(next);
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tableCount: applied }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Sauvegarde échouée");
            const saved = resolveTableCount(data?.tableCount ?? applied);
            setCount(saved);
            setDraftCount(String(saved));
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        void generate();
    }, [generate]);

    const style = `
  @page { size: A4; margin: 10mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .controls { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${widthMm}mm, 1fr)); gap: 8mm; }
  .badge {
    width: ${widthMm}mm; height: ${heightMm}mm; background: #fffaf3;
    border: 1px solid rgba(176, 157, 134, 0.28); border-radius: 12px; box-shadow: 0 6px 20px rgba(54,42,30,.08);
    display: flex; flex-direction: column; justify-content: space-between; padding: 6mm; break-inside: avoid;
  }
  .brand { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12pt; color: #2f2922; }
  .brand .emoji { font-size: 16pt; }
  .title { font-size: 9.5pt; color: rgba(79, 70, 60, 0.75); text-transform: uppercase; letter-spacing: 0.24em; }
  .table { font-weight: 800; font-size: 16pt; line-height: 1; color: #1f1914; }
  .qrwrap { display: flex; align-items: center; justify-content: space-between; gap: 6mm; }
  .qrwrap img { width: 32mm; height: 32mm; object-fit: contain; }
  .urlbox { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; font-size: 9pt; color: #61574d; }
  .hint { font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase; }
  .link {
      background: linear-gradient(135deg, #d9a86c 0%, #be7f39 100%);
      color: #fff;
      border-radius: 8px;
      padding: 3px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 8.5pt;
  }
  @media print { .controls { display: none !important; } body { background: white; } .grid { gap: 6mm; } }
  `;

    return (
        <main className="page-shell space-y-6">
            <style>{style}</style>

            <div className="controls surface-card-strong px-6 py-6">
                <span className="text-xl font-semibold">Badges QR — Coin de table</span>

                <label className="text-sm font-medium surface-muted-text">
                    Tables:
                    <input
                        type="number"
                        min={MIN_TABLE_COUNT}
                        max={MAX_TABLE_COUNT}
                        value={draftCount}
                        onChange={(e) => setDraftCount(e.target.value)}
                        className="w-20"
                    />
                </label>
                <button
                    type="button"
                    className="btn-ghost"
                    disabled={saving}
                    onClick={() => void saveTableCount(Number(draftCount))}
                >
                    {saving ? "…" : "Appliquer"}
                </button>
                <button
                    type="button"
                    className="btn-soft"
                    disabled={saving || count >= MAX_TABLE_COUNT}
                    onClick={() => void saveTableCount(count + 1)}
                >
                    + 1 table
                </button>

                <label className="text-sm font-medium surface-muted-text">
                    Largeur (mm):
                    <input
                        type="number" min={40} max={120} value={widthMm}
                        onChange={(e) => setWidthMm(parseInt(e.target.value || "85", 10))}
                        className="w-20"
                    />
                </label>

                <label className="text-sm font-medium surface-muted-text">
                    Hauteur (mm):
                    <input
                        type="number" min={30} max={120} value={heightMm}
                        onChange={(e) => setHeightMm(parseInt(e.target.value || "55", 10))}
                        className="w-20"
                    />
                </label>

                <label className="text-sm font-medium surface-muted-text">
                    Nom:
                    <input
                        type="text" value={restaurantName}
                        onChange={(e) => setRestaurantName(e.target.value)}
                        className="w-48"
                    />
                </label>

                <label className="text-sm font-medium surface-muted-text">
                    Logo:
                    <input
                        type="text" value={logoEmoji}
                        onChange={(e) => setLogoEmoji(e.target.value)}
                        className="w-20"
                    />
                </label>

                <button onClick={generate} disabled={busy} className="btn-ghost">
                    {busy ? "Génération…" : "Régénérer"}
                </button>
                <button onClick={() => window.print()} className="btn-primary">
                    Imprimer
                </button>
            </div>

            {codes.length === 0 ? (
                <p className="surface-muted-text">Générez les QR pour afficher les badges…</p>
            ) : (
                <section className="grid">
                    {codes.map((q) => (
                        <article key={q.table} className="badge">
                            <div>
                                <div className="brand">
                                    <span className="emoji" aria-hidden>{logoEmoji}</span>
                                    <span>{restaurantName}</span>
                                </div>
                                <div className="title">Scannez pour commander</div>
                                <div className="table">Table {q.table}</div>
                            </div>

                            <div className="qrwrap">
                                <Image
                                    src={q.dataUrl}
                                    alt={`QR Table ${q.table}`}
                                    width={256}
                                    height={256}
                                    unoptimized
                                />
                                <div className="urlbox">
                                    <div className="hint">Ou tapez l’adresse :</div>
                                    <div className="link">
                                        {baseUrl.replace(/^https?:\/\//, "")}/table/{q.table}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </main>
    );
}

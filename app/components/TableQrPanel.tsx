"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { generateTableQrCodes, type TableQrCode } from "@/lib/generate-table-qrs";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import {
  DEFAULT_TABLE_COUNT,
  MAX_TABLE_COUNT,
  MIN_TABLE_COUNT,
  clampTableCount,
  resolveTableCount,
} from "@/lib/table-count";

type Props = {
  variant?: "admin" | "serveur";
  onTableCountSaved?: (count: number) => void;
  showBadgesLink?: boolean;
  title?: string;
  subtitle?: string;
};

export function TableQrPanel({
  variant = "admin",
  onTableCountSaved,
  showBadgesLink = variant === "admin",
  title = "QR codes tables",
  subtitle = "Un QR code par table. Augmentez le nombre pour en ajouter à l'impression.",
}: Props) {
  const [savedCount, setSavedCount] = useState(DEFAULT_TABLE_COUNT);
  const [draftCount, setDraftCount] = useState(String(DEFAULT_TABLE_COUNT));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<TableQrCode[]>([]);

  const baseUrl = useMemo(() => getPublicBaseUrl(), []);

  const loadCount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Chargement impossible");
      const count = resolveTableCount(data?.tableCount);
      setSavedCount(count);
      setDraftCount(String(count));
      onTableCountSaved?.(count);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur chargement";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [onTableCountSaved]);

  const generate = useCallback(
    async (count: number) => {
      if (!baseUrl) return;
      setBusy(true);
      try {
        const arr = await generateTableQrCodes(baseUrl, count);
        setCodes(arr);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Génération impossible";
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!loading && savedCount > 0) {
      void generate(savedCount);
    }
  }, [loading, savedCount, generate]);

  async function persistCount(count: number) {
    const next = clampTableCount(count);
    setSaving(true);
    try {
      const res =
        variant === "admin"
          ? await fetch("/api/admin/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tableCount: next }),
            })
          : await fetch("/api/kitchen/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tableCount: next }),
            });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Sauvegarde échouée");
      }
      const applied = resolveTableCount(data?.tableCount ?? next);
      setSavedCount(applied);
      setDraftCount(String(applied));
      onTableCountSaved?.(applied);
      toast.success(`${applied} table${applied > 1 ? "s" : ""} — QR codes mis à jour`);
      await generate(applied);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur sauvegarde";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function applyDraft() {
    await persistCount(Number(draftCount));
  }

  async function addOneTable() {
    await persistCount(savedCount + 1);
  }

  return (
    <div className="space-y-8">
      <header className="surface-card-strong px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="chip">QR codes</span>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="surface-muted-text text-sm max-w-xl">{subtitle}</p>
          {!loading && (
            <p className="text-sm font-medium text-[var(--color-accent-strong)]">
              {savedCount} QR code{savedCount > 1 ? "s" : ""} actif{savedCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm flex items-center gap-3 font-medium surface-muted-text">
            Nombre de tables
            <input
              type="number"
              min={MIN_TABLE_COUNT}
              max={MAX_TABLE_COUNT}
              value={draftCount}
              onChange={(e) => setDraftCount(e.target.value)}
              className="w-24"
              disabled={loading || saving}
            />
          </label>
          <button
            type="button"
            onClick={() => void applyDraft()}
            disabled={loading || saving || busy}
            className="btn-ghost"
          >
            {saving ? "Enregistrement…" : "Appliquer"}
          </button>
          <button
            type="button"
            onClick={() => void addOneTable()}
            disabled={loading || saving || busy || savedCount >= MAX_TABLE_COUNT}
            className="btn-soft"
          >
            + 1 table
          </button>
          <button
            type="button"
            onClick={() => void generate(savedCount)}
            disabled={loading || busy || savedCount < 1}
            className="btn-ghost"
          >
            {busy ? "Génération…" : "Régénérer"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={codes.length === 0}
            className="btn-primary"
          >
            Imprimer
          </button>
          {showBadgesLink && (
            <Link
              href="/admin/qrs/badges"
              className="btn-soft"
              title="Format carte de visite (85×55 mm) à coller sur les tables"
            >
              Format badges
            </Link>
          )}
        </div>
      </header>

      {loading ? (
        <p className="surface-muted-text">Chargement…</p>
      ) : codes.length === 0 ? (
        <p className="surface-muted-text">Pas encore de QR…</p>
      ) : (
        <section className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid print:grid-cols-3">
          {codes.map((q) => (
            <article
              key={q.table}
              className="surface-card px-5 py-6 flex flex-col items-center gap-4 print:break-inside-avoid"
            >
              <Image
                src={q.dataUrl}
                alt={`Table ${q.table}`}
                className="w-44 h-44"
                width={256}
                height={256}
                unoptimized
              />
              <div className="text-center space-y-1">
                <div className="text-sm surface-muted-text tracking-[0.3em] uppercase">
                  Scannez pour commander
                </div>
                <div className="text-2xl font-semibold">Table {q.table}</div>
                <div className="text-xs surface-muted-text mt-1 font-mono">
                  {baseUrl.replace(/^https?:\/\//, "")}/table/{q.table}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

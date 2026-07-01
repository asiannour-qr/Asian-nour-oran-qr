"use client";

import { useState } from "react";
import { formatMoney, currencySuffix } from "@/lib/currency";

export type SupplementDef = { label: string; priceCents: number };

function parsePriceToCents(input: string): number {
  const n = parseFloat(String(input).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/**
 * Sélecteur de suppléments pour un article.
 * - mode "client" : choix strict dans la liste autorisée (cases à cocher).
 * - mode "staff"  : suppléments libres (intitulé + montant).
 */
export default function SupplementPicker({
  itemName,
  mode,
  allowed,
  onClose,
  onConfirm,
}: {
  itemName: string;
  mode: "client" | "staff";
  allowed: SupplementDef[];
  onClose: () => void;
  onConfirm: (supplements: SupplementDef[]) => void;
}) {
  const [selected, setSelected] = useState<boolean[]>(() => allowed.map(() => false));
  const [freeRows, setFreeRows] = useState<{ label: string; price: string }[]>([
    { label: "", price: "" },
  ]);

  function confirm() {
    if (mode === "client") {
      const chosen = allowed.filter((_, i) => selected[i]);
      onConfirm(chosen);
      return;
    }
    const chosen = freeRows
      .map((r) => ({ label: r.label.trim(), priceCents: parsePriceToCents(r.price) }))
      .filter((r) => r.label.length > 0);
    onConfirm(chosen);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl shadow-elevated max-h-[85dvh] flex flex-col">
        <header className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="text-xs uppercase tracking-wide surface-muted-text">Suppléments</div>
          <div className="text-lg font-semibold text-[var(--color-heading)] leading-snug">
            {itemName}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {mode === "client" ? (
            allowed.length === 0 ? (
              <p className="surface-muted-text text-sm">Aucun supplément disponible.</p>
            ) : (
              allowed.map((s, i) => (
                <label
                  key={`${s.label}-${i}`}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 cursor-pointer transition ${
                    selected[i]
                      ? "border-[var(--color-accent)] bg-[rgba(190,127,57,0.10)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected[i]}
                      onChange={(e) =>
                        setSelected((prev) =>
                          prev.map((v, j) => (j === i ? e.target.checked : v))
                        )
                      }
                      className="h-5 w-5 accent-[var(--color-accent)]"
                    />
                    <span className="font-medium text-sm">{s.label}</span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-accent-strong)]">
                    + {formatMoney(s.priceCents)}
                  </span>
                </label>
              ))
            )
          ) : (
            <>
              <p className="surface-muted-text text-xs">
                Mode serveur — supplément libre (intitulé + montant en {currencySuffix()}).
              </p>
              {freeRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.label}
                    onChange={(e) =>
                      setFreeRows((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r))
                      )
                    }
                    placeholder="ex : Supplément fromage"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm"
                  />
                  <div className="relative w-28 shrink-0">
                    <input
                      value={row.price}
                      onChange={(e) =>
                        setFreeRows((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r))
                        )
                      }
                      inputMode="decimal"
                      placeholder="0"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 pr-9 text-right text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs surface-muted-text">
                      {currencySuffix()}
                    </span>
                  </div>
                  {freeRows.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost text-red-600 px-2"
                      onClick={() => setFreeRows((rows) => rows.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-soft text-sm"
                onClick={() => setFreeRows((rows) => [...rows, { label: "", price: "" }])}
              >
                + Ajouter une ligne
              </button>
            </>
          )}
        </div>

        <footer className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary flex-1" onClick={confirm}>
            Valider
          </button>
        </footer>
      </div>
    </div>
  );
}

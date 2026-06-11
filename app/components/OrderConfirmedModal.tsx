"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  tableId?: string;
  onClose: () => void;
};

export default function OrderConfirmedModal({ open, tableId, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => closeRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-confirmed-title"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-[rgba(255,252,247,0.98)] shadow-[0_24px_70px_rgba(61,47,33,0.28)]">
        <div className="h-1 bg-[var(--color-accent-strong,#7a5640)]" />

        <div className="px-6 py-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
            <span className="text-3xl" aria-hidden="true">
              ✓
            </span>
          </div>

          <div className="space-y-2">
            <h2 id="order-confirmed-title" className="text-xl font-semibold text-[var(--color-heading,#3d2f21)]">
              Commande bien reçue !
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-muted,#6b5d4f)]">
              Votre commande a été prise en compte
              {tableId ? ` pour la table ${tableId}` : ""}. Vos plats vont bientôt arriver — bon appétit !
            </p>
          </div>
        </div>

        <div className="border-t border-[var(--color-border,rgba(190,127,57,0.22))] px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-primary w-full py-3 text-base"
          >
            Parfait, merci !
          </button>
        </div>
      </div>
    </div>
  );
}

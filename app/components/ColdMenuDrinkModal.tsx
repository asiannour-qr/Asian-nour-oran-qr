"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildColdMenuCartLabel,
  filterDrinkOptions,
  type ColdMenuItem,
} from "@/lib/cold-menus";

type DrinkOption = {
  id: string;
  name: string;
  category: string;
  available?: boolean;
};

type ColdMenuDrinkModalProps = {
  menu: ColdMenuItem;
  menuItems: DrinkOption[];
  formatPrice: (cents: number) => string;
  confirmLabel?: string;
  onConfirm: (cartLabel: string, priceCents: number) => void;
  onClose: () => void;
};

export default function ColdMenuDrinkModal({
  menu,
  menuItems,
  formatPrice,
  confirmLabel,
  onConfirm,
  onClose,
}: ColdMenuDrinkModalProps) {
  const drinks = useMemo(() => filterDrinkOptions(menuItems), [menuItems]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    setSelectedId("");
  }, [menu.id]);

  const selectedDrink = drinks.find((d) => d.id === selectedId) ?? null;

  function handleConfirm() {
    if (!selectedDrink) return;
    onConfirm(buildColdMenuCartLabel(menu.name, selectedDrink.name), menu.priceCents);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center bg-black/40 sm:p-4">
      <div
        className="surface-card w-full sm:max-w-lg sm:mx-auto rounded-t-2xl sm:rounded-2xl shadow-elevated flex flex-col max-h-[100dvh] sm:max-h-[90dvh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cold-menu-drink-title"
      >
        <div className="shrink-0 px-5 pt-5 pb-3 sm:px-6 border-b border-[var(--color-border)] space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 id="cold-menu-drink-title" className="text-xl font-semibold">
                Choisir votre boisson
              </h3>
              <p className="text-sm surface-muted-text">{menu.name}</p>
            </div>
            <span className="text-sm font-semibold text-[var(--color-accent-strong)] shrink-0">
              {formatPrice(menu.priceCents)}
            </span>
          </div>
          {menu.description ? (
            <p className="text-xs surface-muted-text leading-snug">{menu.description}</p>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 px-5 py-4 sm:px-6">
          {drinks.length === 0 ? (
            <p className="text-sm surface-muted-text text-center py-8">
              Aucune boisson disponible pour le moment. Contactez la caisse.
            </p>
          ) : (
            <div
              className="max-h-[min(52vh,360px)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] divide-y divide-[var(--color-border)]"
              role="listbox"
              aria-label="Liste des boissons"
            >
              {drinks.map((drink) => {
                const active = drink.id === selectedId;
                return (
                  <button
                    key={drink.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(drink.id)}
                    className={[
                      "w-full px-4 py-3.5 text-left text-sm sm:text-base transition flex items-center justify-between gap-3",
                      active
                        ? "bg-[rgba(217,168,108,0.18)] text-[var(--color-heading)] font-semibold"
                        : "hover:bg-[rgba(217,168,108,0.08)]",
                    ].join(" ")}
                  >
                    <span>{drink.name}</span>
                    {active ? (
                      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
                        Sélectionné
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <button className="btn-ghost w-full sm:w-auto py-3" type="button" onClick={onClose}>
              Annuler
            </button>
            <button
              className="btn-primary w-full sm:w-auto py-3"
              type="button"
              onClick={handleConfirm}
              disabled={!selectedDrink}
            >
              {confirmLabel ?? `Ajouter (${formatPrice(menu.priceCents)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

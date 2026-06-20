"use client";

import { formatMoney } from "@/lib/currency";

type CompactCartBarProps = {
  itemCount: number;
  totalCents: number;
  onClear: () => void;
  onOpen: () => void;
  openLabel?: string;
};

export default function CompactCartBar({
  itemCount,
  totalCents,
  onClear,
  onOpen,
  openLabel = "Voir",
}: CompactCartBarProps) {
  const hasItems = itemCount > 0;

  return (
    <div className="surface-card-strong border border-[var(--color-border)] shadow-sm px-3 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0 text-xs sm:text-sm font-semibold leading-tight">
        <span className="sm:hidden">
          🛒 {itemCount} · {formatMoney(totalCents)}
        </span>
        <span className="hidden sm:inline">
          Panier — {itemCount} article{itemCount > 1 ? "s" : ""} — {formatMoney(totalCents)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="btn-ghost text-xs px-2 py-1 sm:text-sm sm:px-3"
          onClick={onClear}
          disabled={!hasItems}
        >
          Vider
        </button>
        <button
          type="button"
          className="btn-primary text-xs px-2.5 py-1 sm:text-sm sm:px-4"
          onClick={onOpen}
          disabled={!hasItems}
        >
          {openLabel}
        </button>
      </div>
    </div>
  );
}

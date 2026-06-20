"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/currency";

type FormulaMenuCardProps = {
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  description?: string | null;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  unavailable?: boolean;
  fallbackAction?: ReactNode;
};

export function FormulaMenuGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">{children}</div>
  );
}

export default function FormulaMenuCard({
  name,
  priceCents,
  imageUrl,
  description,
  actionLabel,
  onAction,
  disabled = false,
  unavailable = false,
  fallbackAction,
}: FormulaMenuCardProps) {
  const blocked = unavailable || disabled;

  return (
    <div
      className={`surface-card overflow-hidden flex flex-col rounded-2xl border border-[var(--color-border)] relative ${
        unavailable ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {imageUrl ? (
        <div className="relative w-full aspect-[4/3] bg-[var(--color-background-secondary)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-[var(--color-background-secondary)] flex items-center justify-center text-2xl sm:text-3xl select-none">
          🍱
        </div>
      )}
      <div className="flex flex-col flex-1 px-2.5 pt-2 pb-2.5 sm:px-3 sm:pb-3 gap-1.5 sm:gap-2">
        <div className="flex-1 min-h-0">
          <div className="font-medium text-xs sm:text-sm leading-snug line-clamp-2">{name}</div>
          {description ? (
            <p className="text-[11px] sm:text-xs surface-muted-text mt-0.5 line-clamp-2">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs sm:text-sm font-semibold text-[var(--color-accent-strong)]">
            {formatMoney(priceCents)}
          </span>
          {unavailable ? (
            <span className="text-[10px] sm:text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-muted,#333)] rounded px-1.5 py-0.5">
              Indisponible
            </span>
          ) : fallbackAction ? (
            fallbackAction
          ) : (
            <button
              type="button"
              className="btn-soft text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 shrink-0"
              onClick={onAction}
              disabled={blocked}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

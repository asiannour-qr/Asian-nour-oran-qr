"use client";

import { useState } from "react";
import MenuCardGallery from "@/app/components/MenuCardGallery";
import { MenuCardFullscreenOverlay } from "@/app/components/MenuCardFullscreenOverlay";

type HomeMenuCardSectionProps = {
  alt: string;
};

export function HomeMenuCardSection({ alt }: HomeMenuCardSectionProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="surface-card w-full max-w-2xl px-4 sm:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-left">
            <h2 className="text-lg font-semibold">Notre carte</h2>
            <p className="text-sm surface-muted-text">
              Consultez la carte complète du restaurant avant de commander.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2.5 cursor-pointer select-none">
            <span className="text-sm font-medium text-[var(--color-heading)]">Plein écran</span>
            <button
              type="button"
              role="switch"
              aria-checked={fullscreen}
              aria-label={fullscreen ? "Quitter le plein écran" : "Afficher la carte en plein écran"}
              onClick={() => setFullscreen((v) => !v)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                fullscreen ? "bg-[var(--color-accent-strong)]" : "bg-[var(--color-surface-muted,#c8c0b8)]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  fullscreen ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        {!fullscreen && <MenuCardGallery alt={alt} />}
        {fullscreen && (
          <p className="text-xs surface-muted-text text-center">
            Carte ouverte en plein écran — balayez pour voir toutes les pages.
          </p>
        )}
      </div>

      <MenuCardFullscreenOverlay open={fullscreen} onClose={() => setFullscreen(false)} alt={alt} />
    </>
  );
}

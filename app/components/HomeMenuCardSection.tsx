"use client";

import { useEffect, useState } from "react";
import MenuCardGallery from "@/app/components/MenuCardGallery";

type HomeMenuCardSectionProps = {
  alt: string;
};

export function HomeMenuCardSection({ alt }: HomeMenuCardSectionProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

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

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-[var(--color-background,#f2ede6)]"
          role="dialog"
          aria-modal="true"
          aria-label="Carte du restaurant en plein écran"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgba(120,110,98,0.18)] bg-[rgba(242,237,230,0.96)] px-4 py-3 backdrop-blur-sm">
            <div>
              <p className="text-base font-semibold text-[var(--color-heading)]">Notre carte</p>
              <p className="text-xs surface-muted-text">Pincez pour zoomer · Échap pour fermer</p>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="btn-soft shrink-0 px-4 py-2 text-sm"
            >
              Fermer
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6">
            <MenuCardGallery alt={alt} />
          </div>
        </div>
      )}
    </>
  );
}

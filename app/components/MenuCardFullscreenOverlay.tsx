"use client";

import { useEffect } from "react";
import MenuCardGallery from "@/app/components/MenuCardGallery";

type MenuCardFullscreenOverlayProps = {
  open: boolean;
  onClose: () => void;
  alt: string;
  closeLabel?: string;
};

export function MenuCardFullscreenOverlay({
  open,
  onClose,
  alt,
  closeLabel = "Fermer",
}: MenuCardFullscreenOverlayProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
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
        <button type="button" onClick={onClose} className="btn-soft shrink-0 px-4 py-2 text-sm">
          {closeLabel}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6">
        <MenuCardGallery alt={alt} priorityFirst />
      </div>
    </div>
  );
}

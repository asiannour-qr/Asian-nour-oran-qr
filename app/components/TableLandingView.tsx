"use client";

import { useEffect, useState } from "react";
import MenuCardImage from "@/app/components/MenuCardImage";
import { DEFAULT_MENU_CARD_IMAGE, resolveMenuCardImageUrl, type OpeningHours } from "@/lib/settings";

const JOURS_ORDRE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const JOURS_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

type TableLandingViewProps = {
  tableId: string;
  hasMaster: boolean;
  isMaster: boolean;
  claiming: boolean;
  onBrowseMenu: () => void;
  onTakeCharge: () => void;
};

export default function TableLandingView({
  tableId,
  hasMaster,
  isMaster,
  claiming,
  onBrowseMenu,
  onTakeCharge,
}: TableLandingViewProps) {
  const [restaurantName, setRestaurantName] = useState("Asian Nour");
  const [menuCardSrc, setMenuCardSrc] = useState(DEFAULT_MENU_CARD_IMAGE);
  const [hours, setHours] = useState<OpeningHours>({});
  const [address, setAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setRestaurantName(data.restaurantName || "Asian Nour");
        setMenuCardSrc(resolveMenuCardImageUrl(data));
        setHours(data.openingHours || {});
        setAddress(data.address ?? null);
        setPhone(data.phone ?? null);
      })
      .catch(() => {});
  }, []);

  const hasHours = JOURS_ORDRE.some((j) => hours[j]);
  const masterTakenByOther = hasMaster && !isMaster;

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)] pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="page-shell flex flex-col items-center gap-6">
        <div className="surface-card-strong w-full max-w-2xl px-6 sm:px-8 py-8 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-wide">
            Bienvenue chez {restaurantName}
          </h1>
          <p className="text-sm surface-muted-text">
            Table {tableId} — consultez la carte puis passez votre commande.
          </p>
          {(address || phone) && (
            <div className="text-sm surface-muted-text space-y-1">
              {address && <p>📍 {address}</p>}
              {phone && <p>📞 {phone}</p>}
            </div>
          )}
        </div>

        <div className="w-full max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">📱 Un seul téléphone maître par table</p>
          <p className="mt-1 text-amber-800/90">
            Désignez une personne pour composer le panier et envoyer la commande. Les autres convives
            peuvent consulter la carte sur leur téléphone sans modifier le panier.
          </p>
        </div>

        <div className="surface-card w-full max-w-2xl px-4 sm:px-8 py-6 space-y-4">
          <h2 className="text-lg font-semibold text-center">Notre carte</h2>
          <MenuCardImage src={menuCardSrc} alt={`Carte ${restaurantName}`} priority />
        </div>

        {hasHours && (
          <div className="surface-card w-full max-w-2xl px-6 sm:px-8 py-6 space-y-3">
            <h2 className="text-lg font-semibold text-center">Horaires d&apos;ouverture</h2>
            <ul className="text-sm divide-y divide-black/5">
              {JOURS_ORDRE.map((j) => {
                const h = hours[j];
                if (!h) return null;
                return (
                  <li key={j} className="flex items-center justify-between py-1.5">
                    <span className="font-medium">{JOURS_LABELS[j]}</span>
                    <span className="surface-muted-text">
                      {h.ouvert ? `${h.debut} – ${h.fin}` : "Fermé"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(190,127,57,0.22)] bg-[rgba(245,239,230,0.96)] shadow-[0_-10px_30px_rgba(61,47,33,0.12)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-2xl flex flex-col gap-2">
          <span className="text-center text-sm surface-muted-text">Table #{tableId}</span>
          <button
            type="button"
            onClick={onBrowseMenu}
            className="w-full inline-flex justify-center px-5 py-3 rounded-2xl border border-[rgba(190,127,57,0.35)] bg-white text-[var(--color-heading)] text-base font-semibold hover:bg-[rgba(217,168,108,0.12)] transition"
          >
            Consulter la carte
          </button>
          <button
            type="button"
            onClick={onTakeCharge}
            disabled={claiming || masterTakenByOther}
            className="w-full inline-flex justify-center px-5 py-3.5 rounded-2xl bg-[#7a5640] text-white text-base font-semibold shadow-elevated hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {claiming
              ? "Prise en charge…"
              : masterTakenByOther
                ? "Commande déjà gérée par un autre téléphone"
                : isMaster
                  ? "Reprendre la commande"
                  : "Je gère la commande pour la table"}
          </button>
        </div>
      </div>
    </div>
  );
}

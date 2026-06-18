"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_MENU_CARD_IMAGE } from "@/lib/settings";
import { SITE_CONFIG } from "@/lib/site";

type DayHours = { ouvert: boolean; debut: string; fin: string };
type OpeningHours = Record<string, DayHours>;

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const JOURS_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

type Settings = {
  restaurantName: string;
  address: string | null;
  phone: string | null;
  tableCount: number;
  kitchenSoundEnabled: boolean;
  autoPrintEnabled: boolean;
  openingHours: OpeningHours;
  menuCardImageUrl: string | null;
};

const DEFAULT_HOURS: OpeningHours = Object.fromEntries(
  JOURS.map((j) => [j, { ouvert: j !== "dimanche", debut: "11:30", fin: "22:00" }])
);

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-muted,#4a4a4a)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [pendingCardPreview, setPendingCardPreview] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: Settings) => {
        const hours: OpeningHours = {};
        JOURS.forEach((j) => {
          hours[j] = data.openingHours?.[j] ?? DEFAULT_HOURS[j];
        });
        setSettings({ ...data, openingHours: hours });
      })
      .catch(() => setFlash({ type: "err", msg: "Impossible de charger les réglages" }))
      .finally(() => setLoading(false));
  }, []);

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3500);
  }

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        showFlash("err", data.error ?? "Erreur");
      } else {
        const hours: OpeningHours = {};
        JOURS.forEach((j) => {
          hours[j] = (data as Settings).openingHours?.[j] ?? DEFAULT_HOURS[j];
        });
        setSettings({ ...(data as Settings), openingHours: hours });
        showFlash("ok", "Réglages sauvegardés ✓");
      }
    } catch {
      showFlash("err", "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  function handleInfoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    const fd = new FormData(e.currentTarget);
    save({
      restaurantName: String(fd.get("restaurantName") ?? "").trim() || "Asian Nour",
      address: String(fd.get("address") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
    });
  }

  function handleTablesSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    const fd = new FormData(e.currentTarget);
    const n = parseInt(String(fd.get("tableCount")), 10);
    if (isNaN(n) || n < 1) {
      showFlash("err", "Nombre de tables invalide");
      return;
    }
    save({ tableCount: n });
  }

  function handleHoursSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    save({ openingHours: settings.openingHours });
  }

  async function handleMenuCardSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showFlash("err", "Format non supporté (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showFlash("err", "Fichier trop volumineux (8 Mo max)");
      return;
    }

    setPendingCardPreview(URL.createObjectURL(file));
    setUploadingCard(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/menu-card", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showFlash("err", data.error ?? "Erreur upload");
        return;
      }
      setSettings((s) => (s ? { ...s, menuCardImageUrl: data.menuCardImageUrl } : s));
      showFlash("ok", "Carte mise à jour ✓");
    } catch {
      showFlash("err", "Erreur réseau");
    } finally {
      setUploadingCard(false);
    }
  }

  async function removeMenuCard() {
    if (uploadingCard) return;
    setUploadingCard(true);
    try {
      const res = await fetch("/api/admin/settings/menu-card", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        showFlash("err", data.error ?? "Erreur");
        return;
      }
      setSettings((s) => (s ? { ...s, menuCardImageUrl: null } : s));
      setPendingCardPreview(null);
      showFlash("ok", "Carte par défaut restaurée");
    } catch {
      showFlash("err", "Erreur réseau");
    } finally {
      setUploadingCard(false);
    }
  }

  const menuCardPreview =
    pendingCardPreview ||
    settings?.menuCardImageUrl ||
    DEFAULT_MENU_CARD_IMAGE;

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center h-64 text-[var(--color-text-muted)]">
        Chargement…
      </div>
    );
  }

  if (!settings) return null;

  return (
    <main className="page-shell max-w-2xl space-y-8 pb-16">
      {/* Flash message */}
      {flash && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${
            flash.type === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* ── Infos restaurant ─────────────────────────────── */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-5">Informations du restaurant</h2>
        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Nom du restaurant</label>
            <input
              name="restaurantName"
              defaultValue={settings.restaurantName}
              required
              className="input w-full"
              placeholder="Asian Nour"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Adresse</label>
            <input
              name="address"
              defaultValue={settings.address ?? ""}
              className="input w-full"
              placeholder={SITE_CONFIG.settingsPlaceholders.address}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Téléphone</label>
            <input
              name="phone"
              defaultValue={settings.phone ?? ""}
              className="input w-full"
              placeholder={SITE_CONFIG.settingsPlaceholders.phone}
            />
          </div>
          <button type="submit" className="btn-primary mt-2" disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </form>
      </section>

      {/* ── Carte physique (accueil) ─────────────────────── */}
      <section className="card space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Carte principale (accueil)</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Image affichée sur la page d&apos;accueil et avant la commande (scan QR table).
            JPG, PNG ou WebP — 8 Mo max.
          </p>
        </div>

        <div className="rounded-xl border border-black/10 overflow-hidden bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={menuCardPreview}
            alt="Aperçu de la carte"
            className="w-full h-auto max-h-[420px] object-contain mx-auto"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="btn-soft cursor-pointer">
            {uploadingCard ? "Envoi…" : "Changer la carte"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploadingCard}
              onChange={handleMenuCardSelected}
            />
          </label>
          {settings.menuCardImageUrl && (
            <button
              type="button"
              className="btn-ghost text-red-600"
              disabled={uploadingCard}
              onClick={() => void removeMenuCard()}
            >
              Revenir à la carte par défaut
            </button>
          )}
        </div>
      </section>

      {/* ── Tables ───────────────────────────────────────── */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-5">Tables</h2>
        <form onSubmit={handleTablesSubmit} className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm mb-1">Nombre de tables</label>
            <input
              name="tableCount"
              type="number"
              min={1}
              max={500}
              defaultValue={settings.tableCount}
              required
              className="input w-full"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "…" : "Sauvegarder"}
          </button>
        </form>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Détermine le nombre de QR codes générables depuis l&apos;onglet QRs.
        </p>
      </section>

      {/* ── Options cuisine ──────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Options cuisine &amp; impression</h2>
        <Toggle
          label="Sons cuisine activés"
          checked={settings.kitchenSoundEnabled}
          onChange={(v) => {
            setSettings((s) => s ? { ...s, kitchenSoundEnabled: v } : s);
            save({ kitchenSoundEnabled: v });
          }}
        />
        <Toggle
          label="Impression automatique des commandes"
          checked={settings.autoPrintEnabled}
          onChange={(v) => {
            setSettings((s) => s ? { ...s, autoPrintEnabled: v } : s);
            save({ autoPrintEnabled: v });
          }}
        />
      </section>

      {/* ── Horaires d'ouverture ─────────────────────────── */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-5">Horaires d&apos;ouverture</h2>
        <form onSubmit={handleHoursSubmit} className="space-y-3">
          {JOURS.map((jour) => {
            const h = settings.openingHours[jour] ?? DEFAULT_HOURS[jour];
            return (
              <div key={jour} className="flex items-center gap-3 flex-wrap">
                {/* Toggle ouvert/fermé */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={h.ouvert}
                  onClick={() =>
                    setSettings((s) => {
                      if (!s) return s;
                      return {
                        ...s,
                        openingHours: {
                          ...s.openingHours,
                          [jour]: { ...h, ouvert: !h.ouvert },
                        },
                      };
                    })
                  }
                  className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                    h.ouvert ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-muted,#4a4a4a)]"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      h.ouvert ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="w-24 text-sm font-medium">{JOURS_LABELS[jour]}</span>
                {h.ouvert ? (
                  <>
                    <input
                      type="time"
                      value={h.debut}
                      onChange={(e) =>
                        setSettings((s) => {
                          if (!s) return s;
                          return {
                            ...s,
                            openingHours: {
                              ...s.openingHours,
                              [jour]: { ...h, debut: e.target.value },
                            },
                          };
                        })
                      }
                      className="input w-28 text-sm"
                    />
                    <span className="text-sm text-[var(--color-text-muted)]">→</span>
                    <input
                      type="time"
                      value={h.fin}
                      onChange={(e) =>
                        setSettings((s) => {
                          if (!s) return s;
                          return {
                            ...s,
                            openingHours: {
                              ...s.openingHours,
                              [jour]: { ...h, fin: e.target.value },
                            },
                          };
                        })
                      }
                      className="input w-28 text-sm"
                    />
                  </>
                ) : (
                  <span className="text-sm text-[var(--color-text-muted)] italic">Fermé</span>
                )}
              </div>
            );
          })}
          <button type="submit" className="btn-primary mt-4" disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder les horaires"}
          </button>
        </form>
      </section>
    </main>
  );
}

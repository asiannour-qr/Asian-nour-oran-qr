"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { toastAddedToCart } from "@/lib/cart-toast";
import CategorySlider from "@/app/components/CategorySlider";
import CompactCartBar from "@/app/components/CompactCartBar";
import { ConfirmActionModal } from "@/app/components/ConfirmActionModal";
import FormulaMenuCard, { FormulaMenuGrid } from "@/app/components/FormulaMenuCard";
import FormulaSectionHeading from "@/app/components/FormulaSectionHeading";
import ColdMenuDrinkModal from "@/app/components/ColdMenuDrinkModal";
import {
  ComposableMenu,
  MenuComposerModal,
} from "@/app/components/MenuComposerModal";
import { isColdMenuItem } from "@/lib/cold-menus";
import { buildKitchenItemLabel } from "@/lib/kitchen-item-label";
import {
  COLD_MENUS_SECTION_ID,
  HOT_MENUS_SECTION_ID,
  HOT_MENUS_SLIDER_LABEL,
  COLD_MENUS_SLIDER_LABEL,
  isFormulaMenuCategory,
} from "@/lib/menu-formula-nav";
import { formatMoney } from "@/lib/currency";

type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  position: number;
  description?: string | null;
  imageUrl?: string | null;
  available?: boolean;
};

type CartLine = { id: string; name: string; priceCents: number; qty: number };

const EMPORTER_TRACKING_KEY = "emporter:confirmation";

// Catégories réservées à la composition des menus (non vendues à l'unité)
const HIDDEN_MENU_CATEGORIES = new Set(["Boissons Kid", "Desserts Kid"]);

function slugifyCategory(label: string, fallback: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

export default function EmporterPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [composedMenus, setComposedMenus] = useState<ComposableMenu[]>([]);
  const [composingMenu, setComposingMenu] = useState<ComposableMenu | null>(null);
  const [coldMenuPick, setColdMenuPick] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [comment, setComment] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ code: string; id: string } | null>(null);
  const [trackedStatus, setTrackedStatus] = useState<string>("NEW");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeFormulaId, setActiveFormulaId] = useState<string | null>(HOT_MENUS_SECTION_ID);
  const [isStaff, setIsStaff] = useState(false);
  const cartScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // En mode serveur (tablette dédiée), on ne reprend pas l'écran de
    // confirmation client : après envoi on revient à l'accueil serveur.
    const staff = new URLSearchParams(window.location.search).get("staff") === "1";
    setIsStaff(staff);
    if (staff) return;
    try {
      const raw = sessionStorage.getItem(EMPORTER_TRACKING_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string; id?: string };
      if (parsed?.id && parsed?.code) {
        setConfirmation({ id: parsed.id, code: parsed.code });
        setTrackedStatus("PENDING_PAYMENT");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/menu", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/menus", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([itemsData, menusData]) => {
        setMenu(Array.isArray(itemsData?.items) ? itemsData.items : []);
        const list = Array.isArray(menusData?.menus) ? menusData.menus : [];
        setComposedMenus(list.filter((m: ComposableMenu) => (m.groups?.length ?? 0) > 0));
      })
      .catch(() => toast.error("Impossible de charger la carte"))
      .finally(() => setLoading(false));
  }, []);

  // Sections par catégorie (Boissons en dernier), avec ancres pour la navigation
  const sections = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    const order: string[] = [];
    for (const it of menu) {
      const cat = (it.category || "Divers").trim();
      if (HIDDEN_MENU_CATEGORIES.has(cat)) continue;
      if (isFormulaMenuCategory(cat)) continue;
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat)!.push(it);
    }
    order.sort((a, b) => {
      const aDrink = a.toLowerCase() === "boissons";
      const bDrink = b.toLowerCase() === "boissons";
      if (aDrink && !bDrink) return 1;
      if (!aDrink && bDrink) return -1;
      return 0;
    });
    const slugCounts = new Map<string, number>();
    return order.map((cat, index) => {
      const label = cat === "Boxes" ? "Nos BOX" : cat;
      const baseSlug = slugifyCategory(cat, `section-${index + 1}`);
      const count = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, count + 1);
      const anchorId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
      return {
        anchorId,
        label,
        index,
        items: map.get(cat)!.slice().sort((a, b) => {
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name, "fr");
        }),
      };
    });
  }, [menu]);

  const coldMenuItems = useMemo(
    () =>
      menu
        .filter((it) => isColdMenuItem(it))
        .sort((a, b) => {
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name, "fr");
        }),
    [menu]
  );

  const formulaSliderCategories = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    if (composedMenus.length > 0) {
      items.push({ id: HOT_MENUS_SECTION_ID, label: HOT_MENUS_SLIDER_LABEL });
    }
    if (coldMenuItems.length > 0) {
      items.push({ id: COLD_MENUS_SECTION_ID, label: COLD_MENUS_SLIDER_LABEL });
    }
    return items;
  }, [composedMenus.length, coldMenuItems.length]);

  const sliderCategories = useMemo(
    () => sections.map((s) => ({ id: s.anchorId, label: s.label })),
    [sections]
  );

  useEffect(() => {
    if (!formulaSliderCategories.length) {
      setActiveFormulaId(null);
      return;
    }
    setActiveFormulaId((prev) => {
      if (prev && formulaSliderCategories.some((item) => item.id === prev)) return prev;
      const preferred = formulaSliderCategories.find((item) => item.id === HOT_MENUS_SECTION_ID);
      return preferred?.id ?? formulaSliderCategories[0].id;
    });
  }, [formulaSliderCategories]);

  useEffect(() => {
    if (!sections.length) {
      setActiveCategoryId(null);
      return;
    }
    setActiveCategoryId((prev) => prev ?? sections[0].anchorId);
  }, [sections]);

  // Scroll-spy formules (menus chauds / froids)
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (!formulaSliderCategories.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (!intersecting.length) return;
        intersecting.sort((a, b) => {
          const aIndex = Number((a.target as HTMLElement).dataset.formulaIndex ?? 0);
          const bIndex = Number((b.target as HTMLElement).dataset.formulaIndex ?? 0);
          return aIndex - bIndex;
        });
        const top = intersecting[0];
        if (top?.target?.id) setActiveFormulaId(top.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.1, 0.25] }
    );

    formulaSliderCategories.forEach(({ id }, index) => {
      const el = document.getElementById(id);
      if (el) {
        el.dataset.formulaIndex = String(index);
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [formulaSliderCategories]);

  // Scroll-spy : surligne la catégorie active dans le slider à la carte
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (!intersecting.length) return;
        intersecting.sort((a, b) => {
          const aIndex = Number((a.target as HTMLElement).dataset.categoryIndex ?? 0);
          const bIndex = Number((b.target as HTMLElement).dataset.categoryIndex ?? 0);
          return aIndex - bIndex;
        });
        const top = intersecting[0];
        if (top?.target?.id) setActiveCategoryId(top.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.1, 0.25] }
    );

    const elements = sections
      .map(({ anchorId }) => document.getElementById(anchorId))
      .filter((el): el is HTMLElement => Boolean(el));
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [sections]);

  const totalCents = useMemo(
    () => cart.reduce((s, l) => s + l.priceCents * l.qty, 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const hasCartItems = cart.length > 0;

  const addToCart = useCallback((name: string, priceCents: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.name === name && l.priceCents === priceCents);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { id: `${name}-${priceCents}`, name, priceCents, qty: 1 }];
    });
    toastAddedToCart(name);
  }, []);

  const decFromCart = useCallback((id: string) => {
    setCart((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearEntireCart = useCallback(() => setCart([]), []);

  // Isoler le scroll du panier
  useEffect(() => {
    if (!drawerOpen) return;
    const el = cartScrollRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: true });
    return () => el.removeEventListener("wheel", stop);
  }, [drawerOpen]);

  async function submitOrder() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/emporter/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: comment.trim() || null,
          items: cart.map((l) => ({ name: l.name, price: l.priceCents, qty: l.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || `Commande refusée (${res.status})`);
      }
      if (isStaff) {
        // Tablette serveur : retour à l'accueil serveur (la commande apparaît
        // dans « À valider en caisse » avec son code personnage).
        toast.success(`Commande ${data.code} créée — à valider en caisse`);
        window.location.assign("/serveur");
        return;
      }
      setConfirmation({ code: data.code, id: data.id });
      try {
        sessionStorage.setItem(
          EMPORTER_TRACKING_KEY,
          JSON.stringify({ code: data.code, id: data.id })
        );
      } catch {
        // ignore
      }
      setTrackedStatus("PENDING_PAYMENT");
      setCart([]);
      setComment("");
      setDrawerOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  // Suivi du statut de la commande tant que l'écran de confirmation est affiché
  useEffect(() => {
    if (!confirmation) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/emporter/status/${confirmation.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (active && data?.ok && typeof data.status === "string") {
          setTrackedStatus(data.status);
        }
      } catch {
        // réseau instable : on retentera au prochain tick
      }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [confirmation]);

  // ── Écran de confirmation ──────────────────────────────
  if (confirmation) {
    const statusBanner =
      trackedStatus === "PENDING_PAYMENT"
        ? { cls: "border-blue-300 bg-blue-50 text-blue-800", icon: "💳", text: "En attente de validation : réglez votre commande à la caisse pour qu'elle parte en cuisine." }
        : trackedStatus === "READY"
          ? { cls: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: "🛎", text: "Votre commande est prête ! Présentez votre code à la caisse." }
          : trackedStatus === "SERVED"
            ? { cls: "border-gray-300 bg-gray-50 text-gray-700", icon: "🥢", text: "Commande remise. Bon appétit !" }
            : trackedStatus === "CANCELED"
              ? { cls: "border-red-300 bg-red-50 text-red-700", icon: "⚠️", text: "Commande annulée. Adressez-vous à la caisse." }
              : trackedStatus === "IN_PROGRESS"
                ? { cls: "border-amber-300 bg-amber-50 text-amber-800", icon: "👨‍🍳", text: "Votre commande est en préparation…" }
                : { cls: "border-amber-300 bg-amber-50 text-amber-800", icon: "✅", text: "Paiement validé ! Votre commande part en cuisine…" };
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md surface-card-strong rounded-3xl px-6 py-10 text-center space-y-6">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-semibold text-[var(--color-heading)]">
            Commande envoyée !
          </h1>
          <p className="surface-muted-text text-sm">
            Votre commande à emporter a bien été enregistrée. Voici votre code&nbsp;:
          </p>
          <div className="rounded-2xl border-2 border-[var(--color-accent)] bg-[rgba(190,127,57,0.08)] py-6">
            <div className="text-xs uppercase tracking-[0.3em] surface-muted-text mb-2">
              Votre code
            </div>
            <div className="text-4xl font-extrabold text-[var(--color-accent-strong)]">
              {confirmation.code}
            </div>
          </div>
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-medium leading-relaxed transition-colors ${statusBanner.cls}`}
            role="status"
            aria-live="polite"
          >
            {statusBanner.icon} {statusBanner.text}
          </div>
          <div className="rounded-2xl bg-[rgba(61,47,33,0.06)] px-5 py-4 text-sm text-[var(--color-heading)] leading-relaxed">
            👉 Rendez-vous à l&apos;<strong>hôte de caisse</strong> pour valider
            votre ticket après <strong>paiement</strong>.
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => setConfirmation(null)}
          >
            Nouvelle commande
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[rgba(190,127,57,0.22)] bg-[rgba(245,239,230,0.85)] backdrop-blur-md">
        <div className="mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-[var(--color-heading)] sm:text-lg">
              Asian Nour
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[rgba(255,252,247,0.88)] px-3 py-1 text-xs font-medium text-[var(--color-heading)]">
              À emporter
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(190,127,57,0.35)] bg-[rgba(255,252,247,0.92)] text-[var(--color-heading)] shadow-[0_10px_28px_rgba(61,47,33,0.15)] transition hover:bg-[rgba(217,168,108,0.18)] sm:h-11 sm:w-11"
            aria-label="Voir le panier"
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="page-shell space-y-5 sm:space-y-8">
        <Toaster position="top-right" />

        <header className="surface-card-strong px-4 py-4 sm:px-6 sm:py-6 space-y-1.5 sm:space-y-2">
          <span className="chip">Commande à emporter</span>
          <h1 className="text-2xl sm:text-3xl font-semibold">Asian Nour — À emporter</h1>
          <p className="surface-muted-text text-xs sm:text-sm hidden sm:block">
            Composez votre commande à la carte. Un code personnage vous sera attribué
            à la validation pour récupérer votre commande.
          </p>
        </header>

        {/* Mini cart bar + navigation catégories */}
        <div className="sticky top-[56px] sm:top-[64px] z-30 space-y-2 sm:space-y-2.5">
          <CompactCartBar
            itemCount={itemCount}
            totalCents={totalCents}
            onClear={clearEntireCart}
            onOpen={() => setDrawerOpen(true)}
            openLabel="Panier"
          />

          {!loading && formulaSliderCategories.length > 0 && (
            <CategorySlider
              categories={formulaSliderCategories}
              activeId={activeFormulaId}
              onCategorySelect={(id) => setActiveFormulaId(id)}
            />
          )}

          {!loading && sliderCategories.length > 0 && (
            <>
              <p className="px-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] surface-muted-text">
                À la carte
              </p>
              <CategorySlider
                categories={sliderCategories}
                activeId={activeCategoryId}
                onCategorySelect={(id) => setActiveCategoryId(id)}
              />
            </>
          )}
        </div>

        <section className="space-y-4 sm:space-y-5">
          {loading ? (
            <div className="surface-muted-text">Chargement…</div>
          ) : (
            <>
              {composedMenus.length > 0 && (
                <article
                  id={HOT_MENUS_SECTION_ID}
                  className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
                >
                  <FormulaSectionHeading title="Menus chauds à composer" />
                  <FormulaMenuGrid>
                    {composedMenus.map((m) => (
                      <FormulaMenuCard
                        key={m.id}
                        name={m.name}
                        priceCents={m.priceCents}
                        imageUrl={m.imageUrl}
                        actionLabel="Composer"
                        onAction={() => setComposingMenu(m)}
                      />
                    ))}
                  </FormulaMenuGrid>
                </article>
              )}

              {coldMenuItems.length > 0 && (
                <article
                  id={COLD_MENUS_SECTION_ID}
                  className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
                >
                  <FormulaSectionHeading title="Menus froids à composer" />
                  <FormulaMenuGrid>
                    {coldMenuItems.map((it) => (
                      <FormulaMenuCard
                        key={it.id}
                        name={it.name}
                        priceCents={it.priceCents}
                        imageUrl={it.imageUrl}
                        description={it.description}
                        unavailable={it.available === false}
                        actionLabel="Boisson"
                        onAction={() => setColdMenuPick(it)}
                      />
                    ))}
                  </FormulaMenuGrid>
                </article>
              )}

              {sections.map((section) => (
              <article
                key={section.anchorId}
                id={section.anchorId}
                data-category-index={section.index}
                className="space-y-2.5 sm:space-y-3 scroll-mt-24 sm:scroll-mt-32"
              >
                <h3 className="text-base sm:text-xl font-semibold text-sharp">{section.label}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                  {section.items.map((it) => {
                    const unavailable = it.available === false;
                    return (
                      <div
                        key={it.id}
                        className={`surface-card overflow-hidden flex flex-col rounded-2xl border border-[var(--color-border)] relative ${
                          unavailable ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        {it.imageUrl ? (
                          <div className="relative w-full aspect-[4/3] bg-[var(--color-background-secondary)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={it.imageUrl}
                              alt={it.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] bg-[var(--color-background-secondary)] flex items-center justify-center text-3xl select-none">
                            🍱
                          </div>
                        )}
                        <div className="flex flex-col flex-1 px-3 pt-2 pb-3 gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm leading-snug line-clamp-2">
                              {it.name}
                            </div>
                            {it.description ? (
                              <p className="text-xs surface-muted-text mt-0.5 line-clamp-2">
                                {it.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-sm font-semibold text-[var(--color-accent-strong)]">
                              {formatMoney(it.priceCents)}
                            </span>
                            {unavailable ? (
                              <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-muted,#333)] rounded px-2 py-0.5">
                                Indisponible
                              </span>
                            ) : isColdMenuItem(it) ? (
                              <button
                                className="btn-soft text-xs px-2 py-1 shrink-0"
                                onClick={() => setColdMenuPick(it)}
                              >
                                Choisir boisson
                              </button>
                            ) : (
                              <button
                                className="btn-soft text-xs px-2 py-1 shrink-0"
                                onClick={() => addToCart(buildKitchenItemLabel(it.category, it.name), it.priceCents)}
                              >
                                + Ajouter
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
              ))}
            </>
          )}
        </section>

        {hasCartItems && !drawerOpen && (
          <button
            className="sm:hidden fixed bottom-5 right-5 z-50 rounded-full bg-[var(--color-accent)] text-white px-4 py-3 shadow-elevated flex items-center gap-2"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="font-semibold">Panier</span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--color-accent)] text-xs font-bold">
              {itemCount}
            </span>
          </button>
        )}
      </main>

      {/* Composition d'un menu */}
      {composingMenu && (
        <MenuComposerModal
          menu={composingMenu}
          menuItems={menu}
          formatPrice={formatMoney}
          onClose={() => setComposingMenu(null)}
          onConfirm={(label, priceCents) => {
            addToCart(label, priceCents);
            setComposingMenu(null);
          }}
        />
      )}

      {coldMenuPick && (
        <ColdMenuDrinkModal
          menu={coldMenuPick}
          menuItems={menu}
          formatPrice={formatMoney}
          onClose={() => setColdMenuPick(null)}
          onConfirm={(label, priceCents) => {
            addToCart(label, priceCents);
            setColdMenuPick(null);
          }}
        />
      )}

      {/* Drawer panier */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col bg-[var(--color-surface)] shadow-elevated overflow-hidden">
            <header className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Mon panier</div>
                <div className="text-xs surface-muted-text">
                  {itemCount} article(s) — {formatMoney(totalCents)}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setDrawerOpen(false)}>
                Fermer
              </button>
            </header>

            <div
              ref={cartScrollRef}
              className="flex-1 min-h-0 overflow-y-scroll overscroll-contain px-6 py-4 space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="emporter-comment">
                  Commentaire (optionnel)
                </label>
                <textarea
                  id="emporter-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm"
                  placeholder="Allergies, sans oignon, etc."
                />
              </div>

              {cart.length === 0 ? (
                <p className="surface-muted-text text-sm">Votre panier est vide.</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm leading-snug">{line.name}</div>
                        <div className="text-xs surface-muted-text">{formatMoney(line.priceCents)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 rounded-full border border-[var(--color-border)]"
                          onClick={() => decFromCart(line.id)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                        <button
                          className="px-2 py-1 rounded-full border border-[var(--color-border)]"
                          onClick={() => addToCart(line.name, line.priceCents)}
                        >
                          +
                        </button>
                        <button
                          className="px-2 py-1 rounded-full border border-red-300 text-red-600"
                          onClick={() => removeLine(line.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="shrink-0 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatMoney(totalCents)}</span>
              </div>
              <button
                className="btn-primary w-full py-3.5"
                onClick={() => setConfirmSubmitOpen(true)}
                disabled={cart.length === 0 || submitting}
              >
                {submitting ? "Envoi…" : "Valider la commande"}
              </button>
            </footer>
          </aside>
        </div>
      )}
      <ConfirmActionModal
        open={confirmSubmitOpen}
        title="Confirmer la commande à emporter ?"
        message={`Total ${formatMoney(totalCents)}. Rendez-vous en caisse pour payer avant préparation.`}
        confirmLabel="Confirmer la commande"
        loading={submitting}
        onCancel={() => setConfirmSubmitOpen(false)}
        onConfirm={() => {
          setConfirmSubmitOpen(false);
          void submitOrder();
        }}
      />
    </>
  );
}

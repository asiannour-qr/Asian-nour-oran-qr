"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { toastAddedToCart } from "@/lib/cart-toast";
import CategorySlider from "@/app/components/CategorySlider";
import {
  ComposableMenu,
  MenuComposerModal,
} from "@/app/components/MenuComposerModal";

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

// Catégories réservées à la composition des menus (non vendues à l'unité)
const HIDDEN_MENU_CATEGORIES = new Set(["Boissons Kid", "Desserts Kid"]);

function euro(cents: number) {
  return `${Math.round(cents / 100)} DZD`;
}

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
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [comment, setComment] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ code: string; id: string } | null>(null);
  const [trackedStatus, setTrackedStatus] = useState<string>("NEW");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const cartScrollRef = useRef<HTMLDivElement>(null);

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

  const sliderCategories = useMemo(
    () => sections.map((s) => ({ id: s.anchorId, label: s.label })),
    [sections]
  );

  useEffect(() => {
    if (!sections.length) {
      setActiveCategoryId(null);
      return;
    }
    setActiveCategoryId((prev) => prev ?? sections[0].anchorId);
  }, [sections]);

  // Scroll-spy : surligne la catégorie active dans le slider
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
      setConfirmation({ code: data.code, id: data.id });
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

      <main className="page-shell space-y-8">
        <Toaster position="top-right" />

        <header className="surface-card-strong px-6 py-6 space-y-2">
          <span className="chip">Commande à emporter</span>
          <h1 className="text-3xl font-semibold">Asian Nour — À emporter</h1>
          <p className="surface-muted-text text-sm">
            Composez votre commande à la carte. Un code personnage vous sera attribué
            à la validation pour récupérer votre commande.
          </p>
        </header>

        {/* Mini cart bar + navigation catégories */}
        <div className="sticky top-[56px] sm:top-[64px] z-30 space-y-3">
          <div className="surface-card-strong border border-[var(--color-border)] shadow-sm px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm sm:text-base font-semibold">
              Panier — {itemCount} article(s) — {euro(totalCents)}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={clearEntireCart} disabled={!hasCartItems}>
                Vider
              </button>
              <button className="btn-primary" onClick={() => setDrawerOpen(true)} disabled={!hasCartItems}>
                Ouvrir
              </button>
            </div>
          </div>

          {!loading && sliderCategories.length > 0 && (
            <CategorySlider
              categories={sliderCategories}
              activeId={activeCategoryId}
              onCategorySelect={(id) => setActiveCategoryId(id)}
            />
          )}
        </div>

        {/* À la carte */}
        <section className="space-y-5">
          <div className="section-heading mb-0">
            <h2 className="section-heading__title text-2xl">À la carte</h2>
            <p className="section-heading__subtitle">
              Parcourez la carte et ajoutez librement vos envies à votre commande.
            </p>
          </div>

          {loading ? (
            <div className="surface-muted-text">Chargement…</div>
          ) : (
            <>
              {composedMenus.length > 0 && (
                <article className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-sharp">Menus chauds à composer</h3>
                    <span className="text-xs uppercase tracking-[0.18em] surface-muted-text">
                      Formules guidées
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {composedMenus.map((m) => (
                      <div key={m.id} className="surface-card overflow-hidden rounded-2xl flex flex-col">
                        {m.imageUrl ? (
                          <div className="relative w-full aspect-[4/3] bg-[var(--color-background-secondary)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.imageUrl}
                              alt={m.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        <div className="px-5 py-5 flex flex-col gap-3 flex-1">
                          <div className="flex-1">
                            <div className="text-lg font-semibold text-sharp">{m.name}</div>
                            <div className="surface-muted-text text-sm">{euro(m.priceCents)}</div>
                          </div>
                          <button className="btn-primary" onClick={() => setComposingMenu(m)}>
                            Composer ce menu
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {sections.map((section) => (
              <article
                key={section.anchorId}
                id={section.anchorId}
                data-category-index={section.index}
                className="space-y-3 scroll-mt-32 sm:scroll-mt-40"
              >
                <h3 className="text-xl font-semibold text-sharp">{section.label}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                              {euro(it.priceCents)}
                            </span>
                            {unavailable ? (
                              <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-muted,#333)] rounded px-2 py-0.5">
                                Indisponible
                              </span>
                            ) : (
                              <button
                                className="btn-soft text-xs px-2 py-1 shrink-0"
                                onClick={() => addToCart(it.name, it.priceCents)}
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
          formatPrice={euro}
          onClose={() => setComposingMenu(null)}
          onConfirm={(label, priceCents) => {
            addToCart(label, priceCents);
            setComposingMenu(null);
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
                  {itemCount} article(s) — {euro(totalCents)}
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
                        <div className="text-xs surface-muted-text">{euro(line.priceCents)}</div>
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
                <span>{euro(totalCents)}</span>
              </div>
              <button
                className="btn-primary w-full py-3.5"
                onClick={submitOrder}
                disabled={cart.length === 0 || submitting}
              >
                {submitting ? "Envoi…" : "Valider la commande"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

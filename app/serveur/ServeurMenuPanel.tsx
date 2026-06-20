"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";
import { formatMoney } from "@/lib/currency";

type MenuItemRow = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  available: boolean;
  hideWhenUnavailable: boolean;
  position: number;
  imageUrl?: string | null;
};

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
  title,
  activeClass = "bg-green-500",
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  title?: string;
  activeClass?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs font-medium ${
        disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
      }`}
      title={title}
    >
      <span className="text-[var(--color-heading)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? activeClass : "bg-[var(--color-surface-muted,#4a4a4a)]"
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

export function ServeurMenuPanel() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kitchen/menu-items", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Chargement impossible");
      setItems(
        (data.items ?? []).map((it: MenuItemRow) => ({
          ...it,
          available: it.available !== false,
          hideWhenUnavailable: it.hideWhenUnavailable === true,
        }))
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur chargement";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemRow[]>();
    for (const it of filtered) {
      const key = it.category.trim() || "Divers";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a.toLowerCase() === "boissons") return 1;
        if (b.toLowerCase() === "boissons") return -1;
        return a.localeCompare(b, "fr");
      })
      .map(([category, list]) => ({
        category,
        list: list.sort((a, b) => {
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name, "fr");
        }),
      }));
  }, [filtered]);

  async function patchItem(id: string, patch: Partial<Pick<MenuItemRow, "available" | "hideWhenUnavailable">>) {
    setActingId(id);
    try {
      const res = await fetch(`/api/kitchen/menu-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Mise à jour échouée");
      const updated = data.item as MenuItemRow;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                available: updated.available !== false,
                hideWhenUnavailable: updated.hideWhenUnavailable === true,
              }
            : it
        )
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur";
      toast.error(message);
    } finally {
      setActingId(null);
    }
  }

  async function removeItem(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/kitchen/menu-items/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Suppression échouée");
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeleteTarget(null);
      toast.success("Article supprimé");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const unavailableCount = items.filter((it) => !it.available).length;
  const hiddenCount = items.filter((it) => !it.available && it.hideWhenUnavailable).length;

  return (
    <div className="space-y-6">
      <header className="surface-card-strong px-6 py-6 space-y-2">
        <span className="chip">Gestion carte</span>
        <h1 className="text-3xl font-semibold">Articles du menu</h1>
        <p className="surface-muted-text text-sm max-w-2xl">
          Marquez un article comme indisponible pour l&apos;afficher grisé sur la carte client,
          ou activez <strong>Masquer</strong> pour le retirer complètement de la carte.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs surface-muted-text">
          <span>{items.length} article{items.length !== 1 ? "s" : ""}</span>
          {unavailableCount > 0 && (
            <span className="text-amber-700">
              {unavailableCount} indisponible{unavailableCount !== 1 ? "s" : ""}
            </span>
          )}
          {hiddenCount > 0 && (
            <span className="text-indigo-700">
              {hiddenCount} masqué{hiddenCount !== 1 ? "s" : ""} sur la carte
            </span>
          )}
        </div>
      </header>

      <div className="surface-card px-4 py-3 sm:px-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un article ou une catégorie…"
          className="w-full"
          aria-label="Rechercher un article"
        />
      </div>

      {loading ? (
        <p className="surface-muted-text text-sm px-1">Chargement de la carte…</p>
      ) : grouped.length === 0 ? (
        <p className="surface-muted-text text-sm px-1">Aucun article trouvé.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, list }) => (
            <section key={category} className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--color-heading)] border-b border-[var(--color-border)] pb-2">
                {category}
                <span className="ml-2 text-sm font-normal surface-muted-text">({list.length})</span>
              </h2>
              <div className="grid gap-3">
                {list.map((it) => {
                  const busy = actingId === it.id;
                  const unavailable = !it.available;
                  const hidden = unavailable && it.hideWhenUnavailable;
                  return (
                    <article
                      key={it.id}
                      className={`surface-card rounded-2xl px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
                        hidden
                          ? "border border-indigo-200 bg-indigo-50/40"
                          : unavailable
                            ? "border border-amber-200 bg-amber-50/40"
                            : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--color-heading)]">{it.name}</h3>
                          {!it.available && (
                            <span className="inline-flex rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                              Indisponible
                            </span>
                          )}
                          {hidden && (
                            <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                              Masqué carte
                            </span>
                          )}
                        </div>
                        <p className="text-sm surface-muted-text">{formatMoney(it.priceCents)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:gap-5 shrink-0">
                        <ToggleSwitch
                          checked={it.available}
                          disabled={busy}
                          label="Disponible"
                          title={
                            it.available
                              ? "Article disponible — cliquer pour marquer indisponible"
                              : "Article indisponible — cliquer pour remettre disponible"
                          }
                          onChange={() =>
                            void patchItem(it.id, { available: !it.available })
                          }
                        />
                        <ToggleSwitch
                          checked={it.hideWhenUnavailable}
                          disabled={busy || it.available}
                          label="Masquer"
                          activeClass="bg-indigo-500"
                          title={
                            it.available
                              ? "Disponible uniquement quand l'article est indisponible"
                              : it.hideWhenUnavailable
                                ? "Affiché grisé sur la carte — cliquer pour masquer"
                                : "Masqué sur la carte — cliquer pour afficher grisé"
                          }
                          onChange={() =>
                            void patchItem(it.id, {
                              hideWhenUnavailable: !it.hideWhenUnavailable,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="btn-ghost text-sm text-red-600 hover:bg-red-50 px-3 py-2"
                          disabled={busy}
                          onClick={() => setDeleteTarget(it)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        itemName={deleteTarget?.name ?? ""}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void removeItem(deleteTarget.id);
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  AdminMenu,
  AdminMenuGroup,
  AdminMenuItem,
  MenuComposerDrawer,
} from "./MenuComposerDrawer";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";

type LoadedMenu = AdminMenu & { id: string; groups: AdminMenuGroup[] };

function normalizeMenu(menu: any): LoadedMenu {
  const groups: AdminMenuGroup[] = Array.isArray(menu?.groups)
    ? menu.groups
        .map((g: any) => ({
          id: g?.id ?? undefined,
          name: String(g?.name ?? "").trim(),
          categoryFilter: String(g?.categoryFilter ?? "").trim(),
          minChoices: Number.isFinite(Number(g?.minChoices))
            ? Math.max(0, Math.round(Number(g.minChoices)))
            : 0,
          maxChoices: Number.isFinite(Number(g?.maxChoices))
            ? Math.max(0, Math.round(Number(g.maxChoices)))
            : 0,
          position: Number.isFinite(Number(g?.position)) ? Math.round(Number(g.position)) : 0,
        }))
        .sort((a, b) => a.position - b.position)
    : [];

  return {
    id: String(menu?.id ?? ""),
    name: String(menu?.name ?? ""),
    priceCents: Number.isFinite(Number(menu?.priceCents)) ? Number(menu.priceCents) : 0,
    imageUrl: typeof menu?.imageUrl === "string" && menu.imageUrl ? menu.imageUrl : null,
    active: Boolean(menu?.active ?? true),
    position: Number.isFinite(Number(menu?.position)) ? Number(menu.position) : 0,
    groups,
  };
}

function euro(cents: number) {
  return Math.round(cents / 100) + " DZD";
}

export default function AdminMenusPage() {
  const LIMIT = 50;
  const [menus, setMenus] = useState<LoadedMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [meta, setMeta] = useState({
    total: 0,
    limit: LIMIT,
    offset: 0,
    count: 0,
    hasNext: false,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [drawerInitial, setDrawerInitial] = useState<LoadedMenu | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoadedMenu | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadMenuItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const res = await fetch("/api/menu?all=1", { cache: "no-store" });
      const data = await res.json();
      const items: AdminMenuItem[] = Array.isArray(data?.items)
        ? data.items.map((item: any) => ({
            id: String(item?.id ?? ""),
            name: String(item?.name ?? ""),
            category: String(item?.category ?? ""),
            priceCents: Number.isFinite(Number(item?.priceCents)) ? Number(item.priceCents) : 0,
          }))
        : [];
      setMenuItems(items);
    } catch (err: any) {
      toast.error(err?.message || "Erreur chargement plats");
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenuItems();
  }, [loadMenuItems]);

  const composedMenus = useMemo(() => menus, [menus]);

  const loadMenus = useCallback(async (args?: { offset?: number; query?: string }) => {
    const currentQuery = args?.query ?? debouncedSearch;
    const requestedOffset = Math.max(0, args?.offset ?? 0);
    setMenusLoading(true);
    try {
      const params = new URLSearchParams({
        admin: "1",
        composed: "1",
        withGroups: "1",
        limit: String(LIMIT),
        offset: String(requestedOffset),
      });
      if (currentQuery) {
        params.set("query", currentQuery);
      }

      const res = await fetch(`/api/menus?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const list: LoadedMenu[] = Array.isArray(data?.menus)
        ? data.menus.map(normalizeMenu)
        : [];
      const total = Number.isFinite(Number(data?.meta?.total)) ? Number(data.meta.total) : list.length;

      if (list.length === 0 && total > 0 && requestedOffset > 0) {
        const lastOffset = Math.max(0, Math.floor((total - 1) / LIMIT) * LIMIT);
        if (lastOffset !== requestedOffset) {
          return loadMenus({ offset: lastOffset, query: currentQuery });
        }
      }

      setMenus(list);
      setMeta({
        total,
        limit: LIMIT,
        offset: requestedOffset,
        count: list.length,
        hasNext: data?.meta?.hasNext ?? requestedOffset + list.length < total,
      });
    } catch (err: any) {
      toast.error(err?.message || "Erreur chargement menus");
    } finally {
      setMenusLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadMenus({ offset: 0 });
  }, [loadMenus]);

  function openCreate() {
    setDrawerMode("create");
    setDrawerInitial(null);
    setDrawerOpen(true);
  }

  function openEdit(menu: LoadedMenu) {
    setDrawerMode("edit");
    setDrawerInitial(menu);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
  }

  async function duplicateMenu(menu: LoadedMenu) {
    setDuplicatingId(menu.id);
    try {
      const body = { fromId: menu.id };
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.menu) {
        throw new Error(data?.message || "Duplication impossible");
      }
      const duplicated = normalizeMenu(data.menu);
      toast.success("Menu dupliqué");
      openEdit(duplicated);
      void loadMenus({ offset: meta.offset, query: debouncedSearch });
    } catch (err: any) {
      toast.error(err?.message || "Erreur duplication");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function toggleActive(menu: LoadedMenu) {
    setTogglingId(menu.id);
    try {
      const res = await fetch(`/api/menus/${menu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !menu.active }),
      });
      const data = await res.json();
      if (!res.ok || !data?.menu) {
        throw new Error(data?.message || "Mise à jour impossible");
      }
      toast.success(`Menu ${data.menu?.active ? "activé" : "mis en pause"}`);
      await loadMenus({ offset: meta.offset, query: debouncedSearch });
    } catch (err: any) {
      toast.error(err?.message || "Erreur de mise à jour");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteMenu(menu: LoadedMenu) {
    setDeletingId(menu.id);
    try {
      const res = await fetch(`/api/menus/${menu.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Suppression impossible");
      }
      toast.success("Menu supprimé");
      setDeleteTarget(null);
      await loadMenus({ offset: meta.offset, query: debouncedSearch });
    } catch (err: any) {
      toast.error(err?.message || "Erreur de suppression");
    } finally {
      setDeletingId(null);
    }
  }

  const hasPrev = meta.offset > 0;
  const hasNext = meta.hasNext;
  const start = meta.total === 0 ? 0 : meta.offset + 1;
  const end = meta.offset + menus.length;

  function goToPrev() {
    if (!hasPrev || menusLoading) return;
    const nextOffset = Math.max(0, meta.offset - meta.limit);
    void loadMenus({ offset: nextOffset, query: debouncedSearch });
  }

  function goToNext() {
    if (!hasNext || menusLoading) return;
    const nextOffset = meta.offset + meta.limit;
    void loadMenus({ offset: nextOffset, query: debouncedSearch });
  }

  return (
    <main className="page-shell space-y-8">
      <Toaster position="top-right" />

      <header className="section-heading">
        <span className="chip">Menus composés</span>
        <h1 className="section-heading__title">Gestion des menus composables</h1>
        <p className="section-heading__subtitle">
          Créez des formules guidées (entrée, plat, boisson…) en réutilisant vos plats existants. Les menus créés ici
          sont immédiatement disponibles pour vos clients et la cuisine sans modification supplémentaire.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-primary" onClick={openCreate} disabled={menusLoading}>
          Nouveau menu composé
        </button>
        <div className="flex items-center gap-3">
          <label className="text-sm surface-muted-text">Recherche</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex : Royal, Midi, Boisson"
            className="w-56"
          />
        </div>
      </div>

      <section className="surface-card px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Menus composés</h2>
          <span className="text-sm surface-muted-text">
            {menusLoading ? "Chargement…" : `${meta.total} menu(s) composés`}
          </span>
        </div>

        {menusLoading ? (
          <p className="surface-muted-text">Chargement des menus…</p>
        ) : composedMenus.length === 0 ? (
          <div className="surface-muted-text text-sm">
            Aucun menu composé pour le moment. Créez-en un via le bouton ci-dessus ou dupliquez un menu existant.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {composedMenus.map((menu) => (
              <article
                key={menu.id}
                className="surface-panel px-5 py-5 rounded-2xl border border-[rgba(120,110,98,0.14)] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    {menu.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={menu.imageUrl}
                        alt={menu.name}
                        className="h-16 w-16 rounded-xl object-cover border border-[rgba(120,110,98,0.18)] shrink-0"
                      />
                    ) : null}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{menu.name}</h3>
                      <span className="chip text-xs">Menu</span>
                      {!menu.active && (
                        <span className="px-2 py-1 rounded-full text-xs bg-[rgba(190,127,57,0.15)] text-[var(--color-heading)]">
                          En pause
                        </span>
                      )}
                    </div>
                    <p className="text-sm surface-muted-text">
                      {euro(menu.priceCents)} · Position {menu.position}
                    </p>
                  </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-soft"
                      onClick={() => openEdit(menu)}
                    >
                      Éditer
                    </button>
                    <button
                      className="btn-soft"
                      onClick={() => duplicateMenu(menu)}
                      disabled={duplicatingId === menu.id}
                    >
                      {duplicatingId === menu.id ? "Duplication…" : "Dupliquer"}
                    </button>
                    <button
                      className="btn-soft"
                      onClick={() => toggleActive(menu)}
                      disabled={togglingId === menu.id}
                    >
                      {menu.active ? "Mettre en pause" : "Activer"}
                    </button>
                    <button
                      className="btn-ghost text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(menu)}
                      disabled={deletingId === menu.id}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {menu.groups.length > 0 && (
                  <ul className="space-y-1 text-sm surface-muted-text">
                    {menu.groups.map((group) => (
                      <li key={group.id ?? `${menu.id}-${group.name}-${group.position}`}>
                        • <span className="font-medium text-[var(--color-heading)]">{group.name}</span> —{" "}
                        {group.categoryFilter} (min {group.minChoices}, max {group.maxChoices})
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}

        {meta.total > meta.limit && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(120,110,98,0.15)] pt-4">
            <span className="text-sm surface-muted-text">
              Affichage {start}-{end} sur {meta.total}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-soft"
                onClick={goToPrev}
                disabled={!hasPrev || menusLoading}
              >
                Précédent
              </button>
              <button
                className="btn-soft"
                onClick={goToNext}
                disabled={!hasNext || menusLoading}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>

      {drawerOpen && (
        <MenuComposerDrawer
          open={drawerOpen}
          mode={drawerMode}
          initialMenu={drawerInitial ?? undefined}
          menuItems={menuItems}
          onClose={handleDrawerClose}
          onSaved={() => {
            void loadMenus({ offset: meta.offset, query: debouncedSearch });
          }}
        />
      )}

      {itemsLoading && (
        <p className="text-xs surface-muted-text">
          Chargement des plats disponibles…
        </p>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        itemName={deleteTarget?.name ?? ""}
        loading={deletingId !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteMenu(deleteTarget);
        }}
      />
    </main>
  );
}

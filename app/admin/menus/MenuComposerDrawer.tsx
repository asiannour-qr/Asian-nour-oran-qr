"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export type AdminMenuGroup = {
  id?: string;
  name: string;
  categoryFilter: string;
  minChoices: number;
  maxChoices: number;
  position: number;
};

export type AdminMenu = {
  id?: string;
  name: string;
  priceCents: number;
  active: boolean;
  position: number;
  groups: AdminMenuGroup[];
};

export type AdminMenuItem = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
};

type ComposerGroup = AdminMenuGroup & { tempId: string };

type MenuComposerDrawerProps = {
  open: boolean;
  mode: "create" | "edit";
  initialMenu?: AdminMenu | null;
  menuItems: AdminMenuItem[];
  onClose: () => void;
  onSaved: (menu: AdminMenu) => void;
};

const DEFAULT_GROUPS: ComposerGroup[] = [
  {
    tempId: "default-1",
    name: "Entrée",
    categoryFilter: "Entrées",
    minChoices: 1,
    maxChoices: 1,
    position: 1,
  },
  {
    tempId: "default-2",
    name: "Plat",
    categoryFilter: "Plats",
    minChoices: 1,
    maxChoices: 1,
    position: 2,
  },
  {
    tempId: "default-3",
    name: "Boisson",
    categoryFilter: "Boissons",
    minChoices: 1,
    maxChoices: 1,
    position: 3,
  },
];

function formatCentsInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function toComposerGroups(groups: AdminMenuGroup[] | undefined): ComposerGroup[] {
  if (!groups || groups.length === 0) {
    return DEFAULT_GROUPS.map((g) => ({ ...g }));
  }
  return groups
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((g, index) => ({
      tempId: g.id ?? `grp-${index}`,
      name: g.name,
      categoryFilter: g.categoryFilter,
      minChoices: g.minChoices,
      maxChoices: g.maxChoices,
      position: g.position,
    }));
}

function centsFromInput(input: string): number | null {
  const normalized = input.replace(",", ".").trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 100));
}

function generateTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MenuComposerDrawer({
  open,
  mode,
  initialMenu,
  menuItems,
  onClose,
  onSaved,
}: MenuComposerDrawerProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [priceInput, setPriceInput] = useState("0.00");
  const [position, setPosition] = useState(0);
  const [active, setActive] = useState(true);
  const [groups, setGroups] = useState<ComposerGroup[]>(DEFAULT_GROUPS.map((g) => ({ ...g })));
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const uniq = new Set<string>();
    menuItems.forEach((item) => {
      const label = (item.category ?? "").trim();
      if (label) {
        uniq.add(label);
      }
    });
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, "fr"));
  }, [menuItems]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSaving(false);
    if (initialMenu) {
      setName(initialMenu.name ?? "");
      setPriceInput(formatCentsInput(initialMenu.priceCents ?? 0));
      setPosition(initialMenu.position ?? 0);
      setActive(initialMenu.active ?? true);
      setGroups(toComposerGroups(initialMenu.groups));
    } else {
      setName("");
      setPriceInput("0.00");
      setPosition(0);
      setActive(true);
      setGroups(DEFAULT_GROUPS.map((g) => ({ ...g, tempId: generateTempId("grp") })));
    }
  }, [open, initialMenu]);

  if (!open) {
    return null;
  }

  const title = mode === "create" ? "Nouveau menu composé" : `Éditer ${initialMenu?.name ?? "le menu"}`;

  function updateGroup(index: number, patch: Partial<ComposerGroup>) {
    setGroups((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function addGroup() {
    setGroups((prev) => {
      const nextPosition = prev.length > 0 ? Math.max(...prev.map((g) => g.position)) + 1 : 1;
      return [
        ...prev,
        {
          tempId: generateTempId("grp"),
          name: `Groupe ${prev.length + 1}`,
          categoryFilter: "",
          minChoices: 1,
          maxChoices: 1,
          position: nextPosition,
        },
      ];
    });
  }

  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function appendCategory(index: number, category: string) {
    setGroups((prev) => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;
      const existing = current.categoryFilter
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (!existing.includes(category)) {
        existing.push(category);
        current.categoryFilter = existing.join(" | ");
      }
      return copy;
    });
  }

  async function handleSave() {
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Le nom est obligatoire.");
      setStep(0);
      return;
    }

    const cents = centsFromInput(priceInput);
    if (cents == null) {
      toast.error("Prix invalide (format attendu : 12.90).");
      setStep(0);
      return;
    }

    if (!groups.length) {
      toast.error("Ajoutez au moins un groupe de composition.");
      setStep(1);
      return;
    }

    const normalizedGroups = groups.map((group, index) => {
      const name = group.name.trim() || `Groupe ${index + 1}`;
      const categoryFilter = group.categoryFilter.trim() || name;
      const minChoices = Number.isFinite(group.minChoices) ? Math.max(0, Math.round(group.minChoices)) : 0;
      const maxChoicesRaw = Number.isFinite(group.maxChoices) ? Math.round(group.maxChoices) : minChoices;
      const maxChoices = Math.max(minChoices, maxChoicesRaw);
      const position = Number.isFinite(group.position) ? Math.round(group.position) : index + 1;
      return {
        id: group.id,
        name,
        categoryFilter,
        minChoices,
        maxChoices,
        position,
      };
    });

    setSaving(true);

    try {
      const payload = {
        name: trimmedName,
        active,
        position,
        priceCents: cents,
        groups: normalizedGroups.map(({ id, ...rest }) => ({
          id,
          ...rest,
        })),
      };

      const res = await fetch(
        mode === "create" || !initialMenu?.id ? "/api/menus" : `/api/menus/${initialMenu.id}`,
        {
          method: mode === "create" || !initialMenu?.id ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "create" || !initialMenu?.id
              ? payload
              : {
                  ...payload,
                }
          ),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.menu) {
        throw new Error(data?.message || "Enregistrement impossible");
      }

      onSaved(data.menu);
      toast.success(mode === "create" || !initialMenu?.id ? "Menu créé" : "Menu mis à jour");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erreur d’enregistrement");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-xl bg-white shadow-elevated overflow-y-auto">
        <header className="sticky top-0 flex items-center justify-between gap-4 border-b border-[rgba(120,110,98,0.12)] bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs surface-muted-text">
              Configurez les informations générales puis définissez les groupes de choix affichés sur la borne.
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Fermer
          </button>
        </header>

        <div className="px-6 pt-4 pb-6 space-y-6">
          <nav className="flex items-center gap-3 text-sm">
            <button
              className={`px-3 py-1 rounded-full border ${step === 0 ? "border-[rgba(190,127,57,0.45)] bg-[rgba(190,127,57,0.12)]" : "border-transparent bg-[rgba(120,110,98,0.08)]"}`}
              onClick={() => setStep(0)}
              type="button"
            >
              1. Informations
            </button>
            <button
              className={`px-3 py-1 rounded-full border ${step === 1 ? "border-[rgba(190,127,57,0.45)] bg-[rgba(190,127,57,0.12)]" : "border-transparent bg-[rgba(120,110,98,0.08)]"}`}
              onClick={() => setStep(1)}
              type="button"
            >
              2. Groupes
            </button>
          </nav>

          {step === 0 ? (
            <section className="space-y-4">
              <label className="space-y-1">
                <span className="text-sm font-medium surface-muted-text">Nom du menu</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Menu Asian Royal" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium surface-muted-text">Prix (€)</span>
                  <input
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="12.90"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium surface-muted-text">Position</span>
                  <input
                    type="number"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium surface-muted-text">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Activer ce menu immédiatement
              </label>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Groupes de sélection</h3>
                <button className="btn-soft" onClick={addGroup}>
                  + Ajouter un groupe
                </button>
              </div>

              {groups.length === 0 && (
                <p className="text-sm surface-muted-text">
                  Aucun groupe configuré. Ajoutez des groupes pour définir les étapes de composition du menu.
                </p>
              )}

              <div className="space-y-4">
                {groups.map((group, index) => (
                  <div key={group.tempId} className="surface-panel border border-[rgba(120,110,98,0.15)] rounded-xl px-4 py-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-6 items-end">
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs surface-muted-text uppercase tracking-[0.12em]">Nom</span>
                        <input
                          value={group.name}
                          onChange={(e) => updateGroup(index, { name: e.target.value })}
                          placeholder="Entrée"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs surface-muted-text uppercase tracking-[0.12em]">Catégories cibles</span>
                        <input
                          value={group.categoryFilter}
                          onChange={(e) => updateGroup(index, { categoryFilter: e.target.value })}
                          placeholder='Entrées | Yakitoris (2 pièces)'
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs surface-muted-text uppercase tracking-[0.12em]">Min</span>
                        <input
                          type="number"
                          value={group.minChoices}
                          onChange={(e) => updateGroup(index, { minChoices: Number(e.target.value) })}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs surface-muted-text uppercase tracking-[0.12em]">Max</span>
                        <input
                          type="number"
                          value={group.maxChoices}
                          onChange={(e) => updateGroup(index, { maxChoices: Number(e.target.value) })}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs surface-muted-text uppercase tracking-[0.12em]">Position</span>
                        <input
                          type="number"
                          value={group.position}
                          onChange={(e) => updateGroup(index, { position: Number(e.target.value) })}
                        />
                      </label>
                      <div className="flex justify-end">
                        <button className="btn-ghost text-sm" onClick={() => removeGroup(index)}>
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {categories.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs surface-muted-text">
                          Raccourci catégories :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <button
                              type="button"
                              key={`${group.tempId}-${category}`}
                              onClick={() => appendCategory(index, category)}
                              className="px-3 py-1 rounded-full border border-[rgba(190,127,57,0.25)] text-xs hover:bg-[rgba(190,127,57,0.12)] transition"
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-[rgba(120,110,98,0.12)] bg-white px-6 py-4 flex items-center justify-end gap-3">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}

"use client";

// Modal de composition d'un menu (entrée, plat, boisson…) — version mono-client,
// utilisée par la commande à emporter. Reprend les règles de la page table
// (alias de catégories, filtres multiples A|B|C, contraintes XOR et min/max).

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export type ComposerMenuItem = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  position: number;
  available?: boolean;
};

export type ComposerMenuGroup = {
  id: string;
  name: string;
  categoryFilter: string;
  minChoices: number;
  maxChoices: number;
  position: number;
};

export type ComposableMenu = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  groups?: ComposerMenuGroup[];
};

type ComposeStep = {
  group: ComposerMenuGroup;
  options: ComposerMenuItem[];
  includeCategory: boolean;
  minChoices: number;
  maxChoices: number;
  multi: boolean;
  xorKey?: string | null;
  displayCategory: string;
};

const CAT_ALIASES: Record<string, string | string[]> = {
  "Starter": "Plats Starter",
  "Silver": "Plats Silver",
  "Gold": "Plats Gold",
  "starter": "Plats Starter",
  "silver": "Plats Silver",
  "gold": "Plats Gold",
  "Entrée / Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
  "Entrée/Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
  "Entrée ou Yakitoris": ["Entrées", "Yakitoris (2 pièces)"],
  "Entrée": "Entrées",
  "entrée": "Entrées",
  "Yakitoris": "Yakitoris (2 pièces)",
  "Entrée (2 pièces)": "Entrées",
  "Accompagnement": "Accompagnements",
  "Goûter": "Desserts",
};

function resolveCategoryTokens(raw: string, seen = new Set<string>()): string[] {
  const tokens = raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const queue = tokens.length ? tokens : [raw.trim()];
  const result = new Set<string>();

  const pushToken = (token: string) => {
    if (!token) return;
    const normalized = token.trim();
    if (!normalized) return;
    if (seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());

    const alias =
      CAT_ALIASES[normalized] ??
      CAT_ALIASES[normalized.toLowerCase()] ??
      CAT_ALIASES[normalized.replace(/\s+/g, " ")] ??
      CAT_ALIASES[normalized.replace(/\s+/g, " ").toLowerCase()];

    if (Array.isArray(alias)) {
      alias.forEach((next) => pushToken(next));
    } else if (typeof alias === "string") {
      pushToken(alias);
    } else {
      result.add(normalized);
    }
  };

  queue.forEach((token) => pushToken(token));
  return Array.from(result);
}

function parseCategoryFilter(raw: string) {
  const parts = raw.split("::").map((s) => s.trim()).filter(Boolean);
  const filter = parts.shift() ?? "";
  const meta: Record<string, string> = {};
  for (const part of parts) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v) meta[k.toLowerCase()] = v;
  }
  return { filter, meta };
}

function filterOptionsForGroup(
  menuName: string,
  group: ComposerMenuGroup,
  rawFilter: string,
  options: ComposerMenuItem[]
): ComposerMenuItem[] {
  if (menuName === "Asian Kid’s" && group.name.toLowerCase().includes("accompagnement")) {
    const allowedKeywords = ["riz nature", "nouilles sautées légumes", "riz cantonnais"];
    return options.filter((opt) => {
      const label = opt.name.toLowerCase();
      return allowedKeywords.some((kw) => label.includes(kw));
    });
  }
  if (rawFilter === "Desserts Kid") {
    return options.filter((opt) => opt.name.toLowerCase().includes("compote"));
  }
  if (rawFilter === "Boissons Kid") {
    return options.filter((opt) => opt.name.toLowerCase().includes("capri"));
  }
  return options;
}

function requirementText(step: ComposeStep) {
  if (step.xorKey) {
    return "Choisissez UNE entrée OU UNE paire de yakitoris.";
  }
  if (step.minChoices === step.maxChoices) {
    return `Choisissez ${step.minChoices} option(s).`;
  }
  return `Choisissez entre ${step.minChoices} et ${step.maxChoices} option(s).`;
}

function collectErrors(
  steps: ComposeStep[],
  selectionMap: Record<string, string[]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  const xorTotals = new Map<string, number>();

  for (const step of steps) {
    if (!step.xorKey) continue;
    const current = selectionMap[step.group.id] ?? [];
    xorTotals.set(step.xorKey, (xorTotals.get(step.xorKey) ?? 0) + current.length);
  }

  for (const step of steps) {
    const selectedCount = selectionMap[step.group.id]?.length ?? 0;
    const min = step.xorKey ? 0 : step.minChoices;
    if (selectedCount < min) {
      if (step.minChoices === step.maxChoices) {
        errors[step.group.id] = `Sélectionnez ${step.minChoices} option(s).`;
      } else {
        errors[step.group.id] = `Sélectionnez au moins ${step.minChoices} option(s).`;
      }
    } else if (selectedCount > step.maxChoices) {
      errors[step.group.id] = `Sélectionnez au maximum ${step.maxChoices} option(s).`;
    }
  }

  for (const [key, total] of xorTotals) {
    const related = steps.filter((s) => s.xorKey === key);
    if (total === 0) {
      for (const step of related) {
        errors[step.group.id] = "Choisissez UNE entrée OU UNE paire de yakitoris.";
      }
    } else if (total > 1) {
      for (const step of related) {
        errors[step.group.id] = "Sélectionnez une seule option pour cette étape.";
      }
    }
  }

  return errors;
}

export function buildComposeSteps(
  menu: ComposableMenu,
  menuItems: ComposerMenuItem[]
): { steps: ComposeStep[]; blocking: ComposeStep | null } {
  const categoryOrder = new Map<string, number>();
  const itemsByCategory = new Map<string, ComposerMenuItem[]>();
  let index = 0;
  for (const it of menuItems) {
    const key = (it?.category || "").trim();
    if (!key) continue;
    if (!categoryOrder.has(key)) categoryOrder.set(key, index++);
    const arr = itemsByCategory.get(key) ?? [];
    arr.push(it);
    itemsByCategory.set(key, arr);
  }
  for (const [, arr] of itemsByCategory) {
    arr.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name, "fr");
    });
  }

  const findListByCategory = (cat: string): ComposerMenuItem[] => {
    const categories = resolveCategoryTokens(cat);
    if (!categories.length) return [];
    const collected: ComposerMenuItem[] = [];
    for (const key of categories) {
      const arr = itemsByCategory.get(key);
      if (arr?.length) collected.push(...arr);
    }
    collected.sort((a, b) => {
      const orderA = categoryOrder.get(a.category) ?? Number.MAX_SAFE_INTEGER;
      const orderB = categoryOrder.get(b.category) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name, "fr");
    });
    return collected;
  };

  const sorted = [...(menu.groups ?? [])].sort((a, b) => a.position - b.position);
  const steps: ComposeStep[] = sorted.map((group) => {
    const { filter, meta } = parseCategoryFilter(group.categoryFilter);
    const minRaw = Number.isFinite(group.minChoices) ? Number(group.minChoices) : 1;
    const maxRaw = Number.isFinite(group.maxChoices) ? Number(group.maxChoices) : minRaw;
    const minChoices = Math.max(0, minRaw);
    const maxChoices = Math.max(minChoices || 0, maxRaw);

    const baseOptions = findListByCategory(filter);
    const options = filterOptionsForGroup(menu.name, group, filter, baseOptions)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const includeCategory = new Set(options.map((it) => it.category)).size > 1;
    const multi = maxChoices > 1;

    return {
      group,
      options,
      includeCategory,
      minChoices,
      maxChoices,
      multi,
      xorKey: meta.xor ?? null,
      displayCategory: filter || group.categoryFilter,
    };
  });

  const blocking =
    steps.find((step) => step.options.length === 0 && !step.xorKey && step.minChoices > 0) ?? null;

  return { steps, blocking };
}

type MenuComposerModalProps = {
  menu: ComposableMenu;
  menuItems: ComposerMenuItem[];
  confirmLabel?: string;
  onConfirm: (label: string, priceCents: number) => void;
  onClose: () => void;
  formatPrice: (cents: number) => string;
};

export function MenuComposerModal({
  menu,
  menuItems,
  confirmLabel,
  onConfirm,
  onClose,
  formatPrice,
}: MenuComposerModalProps) {
  const menuItemMap = useMemo(() => {
    const map = new Map<string, ComposerMenuItem>();
    for (const it of menuItems) map.set(it.id, it);
    return map;
  }, [menuItems]);

  const { steps, blocking } = useMemo(() => buildComposeSteps(menu, menuItems), [menu, menuItems]);

  const [selectionMap, setSelectionMap] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string[]> = {};
    for (const step of steps) {
      if (!step.xorKey && step.options.length === 1 && step.maxChoices >= 1) {
        initial[step.group.id] = [step.options[0].id];
      } else {
        initial[step.group.id] = [];
      }
    }
    setSelectionMap(initial);
    setErrors(collectErrors(steps, initial));
  }, [steps]);

  useEffect(() => {
    if (blocking) {
      toast.error(
        `Aucun plat trouvé dans « ${blocking.displayCategory || blocking.group.categoryFilter} ».`
      );
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking]);

  if (blocking) return null;

  function setSelection(step: ComposeStep, values: string[]) {
    setSelectionMap((prev) => {
      const nextMap: Record<string, string[]> = { ...prev, [step.group.id]: values };
      if (step.xorKey && values.length > 0) {
        for (const other of steps) {
          if (other.group.id !== step.group.id && other.xorKey === step.xorKey) {
            nextMap[other.group.id] = [];
          }
        }
      }
      setErrors(collectErrors(steps, nextMap));
      return nextMap;
    });
  }

  function handleSingleSelect(step: ComposeStep, value: string | null) {
    setSelection(step, value ? [value] : []);
  }

  function handleCheckboxToggle(step: ComposeStep, value: string) {
    const current = selectionMap[step.group.id] ?? [];
    const exists = current.includes(value);
    const next = exists ? current.filter((v) => v !== value) : [...current, value];
    if (!exists && next.length > step.maxChoices) {
      toast.error(`Sélection maximale : ${step.maxChoices} option(s).`);
      return;
    }
    setSelection(step, next);
  }

  function handleConfirm() {
    const validation = collectErrors(steps, selectionMap);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error("Complétez les choix du menu avant de valider.");
      return;
    }

    const detailParts: string[] = [];
    for (const step of steps) {
      const selectedIds = selectionMap[step.group.id] ?? [];
      const items = selectedIds
        .map((id) => menuItemMap.get(id))
        .filter((it): it is ComposerMenuItem => Boolean(it));
      if (!items.length) continue;
      const names = items
        .map((it) => (step.includeCategory ? `${it.name} — ${it.category}` : it.name))
        .join(step.multi ? " + " : ", ");
      detailParts.push(`${step.group.name}: ${names}`);
    }
    const label = detailParts.length > 0 ? `${menu.name} — ${detailParts.join(" • ")}` : menu.name;
    onConfirm(label, menu.priceCents);
  }

  const summary = steps
    .map((step) => {
      const selectedIds = selectionMap[step.group.id] ?? [];
      const items = selectedIds
        .map((id) => menuItemMap.get(id))
        .filter((it): it is ComposerMenuItem => Boolean(it));
      if (!items.length) return null;
      return {
        id: step.group.id,
        name: step.group.name,
        value: items.map((it) => it.name).join(step.multi ? " + " : ", "),
      };
    })
    .filter(Boolean) as { id: string; name: string; value: string }[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="surface-card w-full max-w-2xl rounded-2xl p-6 space-y-5 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold">Composer {menu.name}</h3>
          <span className="text-sm surface-muted-text">
            Total menu&nbsp;: {formatPrice(menu.priceCents)}
          </span>
        </div>

        {summary.length > 0 && (
          <div className="surface-panel border border-[rgba(120,110,98,0.18)] rounded-xl px-4 py-3 text-sm space-y-1">
            {summary.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="surface-muted-text">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {steps.map((step) => {
            const selectedIds = selectionMap[step.group.id] ?? [];
            const instruction = requirementText(step);
            const error = errors[step.group.id];

            return (
              <section
                key={step.group.id}
                className={`rounded-xl border px-4 py-3 space-y-2 ${
                  error
                    ? "border-red-400 bg-red-50/60"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{step.group.name}</div>
                  <span className="text-xs surface-muted-text uppercase tracking-[0.18em]">
                    {step.displayCategory || step.group.categoryFilter}
                  </span>
                </div>
                {step.xorKey && (
                  <p className="text-xs font-medium text-amber-600">
                    Choisissez UNE entrée OU UNE paire de yakitoris.
                  </p>
                )}

                {step.options.length === 0 ? (
                  <div className="text-xs surface-muted-text">
                    Aucun plat trouvé pour cette étape. Contactez la caisse.
                  </div>
                ) : step.multi ? (
                  <div className="space-y-2">
                    {step.options.map((opt) => {
                      const checked = selectedIds.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleCheckboxToggle(step, opt.id)}
                            className="w-4 h-4"
                          />
                          <span className="flex-1">
                            {step.includeCategory ? `${opt.name} — ${opt.category}` : opt.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedIds[0] ?? ""}
                    onChange={(e) => handleSingleSelect(step, e.target.value || null)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="">— Sélectionner —</option>
                    {step.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {step.includeCategory ? `${opt.name} — ${opt.category}` : opt.name}
                      </option>
                    ))}
                  </select>
                )}

                <p className="text-xs surface-muted-text">{instruction}</p>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={Object.keys(errors).length > 0}
          >
            {confirmLabel ?? `Ajouter (${formatPrice(menu.priceCents)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

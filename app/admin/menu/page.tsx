"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";

type Item = {
    id: string;
    name: string;
    priceCents: number;
    category: string;
    description?: string | null;
    imageUrl?: string | null;
    spicyLevel?: number | null;
    available: boolean;
    position: number;
};

function euros(cents: number) {
    return String(Math.round(cents / 100));
}

function ImageCell({ item, onUpdated }: { item: Item; onUpdated: () => void }) {
    const [uploading, setUploading] = useState(false);
    const [urlInput, setUrlInput] = useState(item.imageUrl ?? "");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleFileUpload(file: File) {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(`/api/admin/menu/${item.id}/image`, {
                method: "POST",
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Upload échoué");
            toast.success("Image enregistrée");
            onUpdated();
        } catch (e: any) {
            toast.error(e?.message || "Erreur upload");
        } finally {
            setUploading(false);
        }
    }

    async function handleUrlSave() {
        const url = urlInput.trim();
        try {
            const res = await fetch(`/api/admin/menu/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: url || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Mise à jour échouée");
            toast.success("URL sauvegardée");
            setShowUrlInput(false);
            onUpdated();
        } catch (e: any) {
            toast.error(e?.message || "Erreur");
        }
    }

    async function handleDelete() {
        try {
            const res = await fetch(`/api/admin/menu/${item.id}/image`, { method: "DELETE" });
            if (!res.ok) throw new Error("Suppression échouée");
            setUrlInput("");
            toast.success("Image supprimée");
            onUpdated();
        } catch (e: any) {
            toast.error(e?.message || "Erreur suppression");
        }
    }

    return (
        <div className="flex items-center gap-3">
            {item.imageUrl ? (
                <div className="relative group shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-10 object-cover rounded-lg border border-[var(--color-border)]"
                    />
                    <button
                        onClick={handleDelete}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow"
                        title="Supprimer l'image"
                    >
                        ×
                    </button>
                </div>
            ) : (
                <div className="w-14 h-10 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] text-xs shrink-0">
                    —
                </div>
            )}

            <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="btn-ghost text-xs px-2 py-1"
                        title="Uploader une photo"
                    >
                        {uploading ? "…" : "📷"}
                    </button>
                    <button
                        onClick={() => setShowUrlInput((v) => !v)}
                        className="btn-ghost text-xs px-2 py-1"
                        title="Coller une URL"
                    >
                        🔗
                    </button>
                </div>
                {showUrlInput && (
                    <div className="flex gap-1">
                        <input
                            className="text-xs w-40"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://..."
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleUrlSave();
                                if (e.key === "Escape") setShowUrlInput(false);
                            }}
                            autoFocus
                        />
                        <button onClick={() => void handleUrlSave()} className="btn-soft text-xs px-2 py-1">✓</button>
                    </div>
                )}
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f);
                    e.target.value = "";
                }}
            />
        </div>
    );
}

export default function AdminMenuPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [name, setName] = useState("");
    const [price, setPrice] = useState<string>("0");
    const [category, setCategory] = useState("Plats");
    const [available, setAvailable] = useState(true);

    // Catégories existantes + catégories fixes toujours proposées
    const FIXED_CATEGORIES = ["Entrées", "Plats", "Yakitoris", "Sushis", "Maki", "Desserts", "Boissons"];
    const existingCategories = useMemo(() => {
        const set = new Set<string>(FIXED_CATEGORIES);
        items.forEach((it) => { if (it.category) set.add(it.category); });
        return Array.from(set).sort((a, b) => {
            // Boissons toujours en dernier
            if (a === "Boissons") return 1;
            if (b === "Boissons") return -1;
            return a.localeCompare(b, "fr");
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/menu?all=1", { cache: "no-store" });
            const data = await res.json();
            setItems(data.items ?? []);
        } catch (e: any) {
            toast.error(e?.message || "Erreur chargement");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return items;
        return items.filter(
            (it) =>
                it.name.toLowerCase().includes(q) ||
                it.category.toLowerCase().includes(q)
        );
    }, [items, search]);

    const withImage = items.filter((it) => it.imageUrl).length;

    async function createItem() {
        try {
            const res = await fetch("/api/menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    price: Number(price.replace(",", ".")),
                    category: category.trim() || "Divers",
                    available,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Création échouée");
            toast.success("Plat ajouté");
            setName(""); setPrice("0"); setAvailable(true);
            await load();
        } catch (e: any) {
            toast.error(e?.message || "Erreur création");
        }
    }

    async function updateField(id: string, patch: Partial<Item> & { price?: number }) {
        try {
            const body: Record<string, unknown> = { ...patch };
            if (body.price != null) body.price = Number(body.price);
            const res = await fetch(`/api/menu/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Mise à jour échouée");
            toast.success("Modifié");
            await load();
        } catch (e: any) {
            toast.error(e?.message || "Erreur modification");
        }
    }

    async function remove(id: string) {
        setDeleting(true);
        try {
            const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Suppression échouée");
            toast.success("Plat supprimé");
            setDeleteTarget(null);
            await load();
        } catch (e: any) {
            toast.error(e?.message || "Erreur suppression");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <main className="page-shell">
            <Toaster position="top-right" />

            <header className="section-heading mb-8">
                <span className="chip">Administration</span>
                <h1 className="section-heading__title">Gestion de la carte</h1>
                <p className="section-heading__subtitle">
                    Ajoutez, modifiez et organisez vos plats. Ajoutez des photos via
                    📷 (upload) ou 🔗 (URL) sur chaque ligne.
                </p>
                {!loading && (
                    <p className="text-sm text-[var(--color-accent-strong)] font-medium">
                        {withImage} / {items.length} plats avec photo
                    </p>
                )}
            </header>

            {/* Ajout */}
            <section className="surface-card-strong px-6 py-6 mb-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">Ajouter un plat</h2>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn-soft text-sm"
                            onClick={() => { setCategory("Boissons"); setName(""); setPrice("0"); setAvailable(true); }}
                        >
                            🥤 Ajouter une boisson
                        </button>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-5">
                    <input
                        placeholder="Nom"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="md:col-span-2"
                    />
                    <input
                        placeholder="Prix (DZD)"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                    />
                    {/* Catégorie : datalist pour suggestions + saisie libre */}
                    <div className="flex flex-col gap-1">
                        <input
                            list="category-list"
                            placeholder="Catégorie"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        />
                        <datalist id="category-list">
                            {existingCategories.map((cat) => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium surface-muted-text">
                        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="w-4 h-4" />
                        Disponible
                    </label>
                </div>
                <div className="flex justify-end">
                    <button onClick={createItem} className="btn-primary">Ajouter</button>
                </div>
            </section>

            {/* Liste */}
            <section className="surface-card px-6 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-xl font-semibold">Carte ({items.length})</h2>
                    <input
                        placeholder="Rechercher un plat ou catégorie…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-64"
                    />
                </div>

                {loading ? (
                    <div className="surface-muted-text">Chargement…</div>
                ) : filtered.length === 0 ? (
                    <div className="surface-muted-text">Aucun résultat.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-theme">
                            <thead>
                                <tr>
                                    <th>Image</th>
                                    <th>Nom</th>
                                    <th>Catégorie</th>
                                    <th>Prix</th>
                                    <th>Pos.</th>
                                    <th>Dispo</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((it) => (
                                    <tr key={it.id}>
                                        <td>
                                            <ImageCell item={it} onUpdated={load} />
                                        </td>
                                        <td>
                                            <input defaultValue={it.name} onBlur={(e) => updateField(it.id, { name: e.target.value })} />
                                        </td>
                                        <td>
                                            <input
                                                list="category-list"
                                                defaultValue={it.category}
                                                onBlur={(e) => updateField(it.id, { category: e.target.value })}
                                            />
                                        </td>
                                        <td className="flex items-center gap-1">
                                            <input
                                                defaultValue={euros(it.priceCents)}
                                                onBlur={(e) => updateField(it.id, { price: Number(e.target.value.replace(",", ".")) })}
                                                className="w-20"
                                            />
                                            <span className="surface-muted-text text-sm">DZD</span>
                                        </td>
                                        <td>
                                            <input
                                                defaultValue={it.position}
                                                type="number"
                                                className="w-16"
                                                onBlur={(e) => updateField(it.id, { position: Number(e.target.value) })}
                                            />
                                        </td>
                                        <td className="text-center">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={it.available}
                                                onClick={() => updateField(it.id, { available: !it.available })}
                                                title={it.available ? "Disponible — cliquer pour désactiver" : "Indisponible — cliquer pour activer"}
                                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                                    it.available
                                                        ? "bg-green-500"
                                                        : "bg-[var(--color-surface-muted,#4a4a4a)]"
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                                                        it.available ? "translate-x-6" : "translate-x-1"
                                                    }`}
                                                />
                                            </button>
                                        </td>
                                        <td className="text-right">
                                            <button
                                                onClick={() => setDeleteTarget(it)}
                                                className="btn-ghost text-red-600 hover:bg-red-50"
                                            >
                                                Supprimer
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        <ConfirmDeleteModal
            open={deleteTarget !== null}
            itemName={deleteTarget?.name ?? ""}
            loading={deleting}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
                if (deleteTarget) void remove(deleteTarget.id);
            }}
        />
        </main>
    );
}

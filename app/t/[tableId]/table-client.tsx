"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

/** Types attendus depuis/vers l’API */
type ServerCartItem = {
  name: string;
  price: number;            // centimes
  qty: number;
  personId?: string | null; // optionnel
};

type SubmitResponse =
  | { ok: true; id: string }
  | { ok: false; error?: string; code?: string; issues?: unknown };

/**
 * Composant client pour la page /t/[tableId]
 * - charge le panier serveur (GET /api/tables/:tableId/cart)
 * - permet d’ajouter un commentaire
 * - envoie la commande (POST /api/tables/:tableId/submit)
 */
export default function TableClient() {
  const params = useParams<{ tableId: string }>();
  const tableId = params?.tableId;

  const [cart, setCart] = useState<ServerCartItem[]>([]);
  const [comment, setComment] = useState<string>("");
  const [peopleCount, setPeopleCount] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /** Charger le panier depuis l’API serveur */
  const loadCart = useCallback(async () => {
    if (!tableId) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/cart`, { cache: "no-store" });
      if (!res.ok) {
        setError(`Erreur chargement panier (HTTP ${res.status})`);
        setCart([]);
        return;
      }
      const data = await res.json();

      // Le backend peut renvoyer différents formats suivant les versions
      const rawItems: unknown[] =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.cart?.items)
              ? data.cart.items
              : [];

      const cleaned = rawItems
        .map((entry) => {
          const it = entry as Partial<ServerCartItem>;
          return {
            name: String(it?.name ?? "").trim(),
            price: Number(it?.price ?? 0) | 0, // centimes
            qty: Number(it?.qty ?? 0) | 0,
            personId: (it?.personId ?? null) as string | null,
          };
        })
        .filter((it) => it.name && it.qty > 0 && Number.isFinite(it.price));

      setCart(cleaned);

      const serverPeople = Number(data?.cart?.peopleCount ?? data?.peopleCount);
      if (Number.isFinite(serverPeople)) {
        const sanitized = Math.max(1, Math.min(12, Math.round(serverPeople)));
        setPeopleCount(sanitized);
      }
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le panier.");
      setCart([]);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  /** Total pour affichage */
  const totalCents = useMemo(
    () => cart.reduce((sum, it) => sum + it.price * it.qty, 0),
    [cart]
  );
  const totalEuros = useMemo(() => (totalCents / 100).toFixed(2), [totalCents]);

  /** Envoi en cuisine */
  const sendToKitchen = useCallback(async () => {
    if (!tableId) {
      setError("Table introuvable dans l’URL.");
      return;
    }
    if (cart.length === 0) {
      setError("Panier vide.");
      return;
    }

    setError(null);
    setInfo(null);
    setSending(true);

    const normalizedPeople = Math.max(1, Math.min(12, Math.round(Number(peopleCount || 1))));
    const payload = {
      comment: comment.trim().length ? comment.trim() : null,
      peopleCount: normalizedPeople,
      items: cart.map((it) => ({
        name: it.name,
        price: Number(it.price) | 0, // centimes
        qty: Number(it.qty) | 0,
        personId: it.personId ?? null,
      })),
    };

    // Debug : voir exactement ce qui part
    console.log(">> SUBMIT payload", payload);

    try {
      const res = await fetch(`/api/tables/${tableId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: SubmitResponse | null = null;
      try {
        data = (await res.json()) as SubmitResponse;
      } catch {
        // si le serveur n’a pas renvoyé du JSON
        data = { ok: false, error: await res.text() };
      }

      if (!res.ok || !data) {
        setError(`Réponse invalide (HTTP ${res.status}).`);
        return;
      }

      if (!data.ok) {
        const failure = data as Extract<SubmitResponse, { ok: false }>;
        const msg =
          failure.error ||
          (typeof failure.code === "string" ? failure.code : "Erreur inconnue");
        setError(msg);
        return;
      }

      // Succès : vider le commentaire, recharger le panier (serveur le videra selon ton flux)
      setInfo(`Commande envoyée (n° ${data.id}).`);
      setComment("");
      await loadCart();
    } catch (e: any) {
      setError(e?.message || "Erreur réseau.");
    } finally {
      setSending(false);
    }
  }, [tableId, cart, comment, peopleCount, loadCart]);

  /** UI */
  return (
    <div className="surface-card px-6 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Table {tableId}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm surface-muted-text">Nb de personnes</span>
          <input
            type="number"
            min={1}
            value={peopleCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              const next = Number.isFinite(n) ? Math.max(1, Math.min(12, Math.round(n))) : 1;
              setPeopleCount(next);
            }}
            className="w-20"
          />
        </div>
      </header>

      {loading ? (
        <p className="text-sm surface-muted-text">Chargement du panier…</p>
      ) : cart.length === 0 ? (
        <p className="text-sm surface-muted-text">Panier vide. Ajoutez des articles depuis le menu.</p>
      ) : (
        <div className="surface-panel px-4 py-4 space-y-2">
          {cart.map((it, idx) => (
            <div
              key={`${it.name}-${idx}`}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex-1">
                <div className="font-medium">{it.name}</div>
                <div className="surface-muted-text">
                  Qté : {it.qty} — PU : {(it.price / 100).toFixed(2)}€
                  {it.personId ? ` — P${it.personId}` : ""}
                </div>
              </div>
              <div className="ml-3 font-medium">
                {((it.price * it.qty) / 100).toFixed(2)}€
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-2 mt-2 border-t font-semibold">
            <span>Total</span>
            <span>{totalEuros} €</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Commentaire</label>
        <textarea
          className="w-full text-sm"
          rows={3}
          placeholder="Allergies, cuisson, sauces…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={sendToKitchen}
          disabled={sending || cart.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          {sending ? "Envoi…" : "Envoyer en cuisine"}
        </button>

        <button
          onClick={loadCart}
          disabled={sending}
          className="btn-ghost disabled:opacity-50"
        >
          Rafraîchir panier
        </button>
      </div>

      {error && (
        <div className="surface-panel border border-[rgba(220,80,70,0.25)] bg-[rgba(220,80,70,0.12)] text-[rgb(148,45,38)] px-4 py-3 text-sm rounded-2xl">
          {error}
        </div>
      )}
      {info && (
        <div className="surface-panel border border-[rgba(104,168,116,0.25)] bg-[rgba(104,168,116,0.12)] text-[rgb(35,103,58)] px-4 py-3 text-sm rounded-2xl">
          {info}
        </div>
      )}
    </div>
  );
}

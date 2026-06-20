"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  readSoundEnabledPreference,
  writeSoundEnabledPreference,
} from "@/lib/kitchen-sound-preference";
import { useOrderAlertAudio } from "@/lib/use-order-alert-audio";
import {
  filterRelevantTableOrders,
  MAX_TABLE_TICKETS,
  type ServeurOrderLite,
} from "@/lib/serveur-table-orders";
import { formatMoney } from "@/lib/currency";
import { RESTAURANT_TZ } from "@/lib/restaurant-time";
import { ServeurMenuPanel } from "./ServeurMenuPanel";
import { TableQrPanel } from "@/app/components/TableQrPanel";
import { ConfirmActionModal } from "@/app/components/ConfirmActionModal";
import { resolveTableCount } from "@/lib/table-count";

type TableState = "FREE" | "ACTIVE" | "READY" | "OCCUPIED";
type ServeurTab = "tables" | "menu" | "qrcodes";

type OrderLite = ServeurOrderLite & {
  code?: string | null;
  comment?: string | null;
};

const ACTIVE_STATUSES = new Set(["NEW", "IN_PROGRESS"]);

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: RESTAURANT_TZ,
  });
}

export default function ServeurPage() {
  const [tableCount, setTableCount] = useState<number | null>(null);
  const [tableStates, setTableStates] = useState<Record<string, TableState>>({});
  const [tableOrders, setTableOrders] = useState<Record<string, OrderLite[]>>({});
  const [occupiedTables, setOccupiedTables] = useState<Set<string>>(() => new Set());
  const [tableOccupancyMeta, setTableOccupancyMeta] = useState<
    Record<string, { occupiedAt: string; lastOrderId?: string | null }>
  >({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [releasingTable, setReleasingTable] = useState<string | null>(null);
  const [removingOrderId, setRemovingOrderId] = useState<string | null>(null);
  const [takeawayActive, setTakeawayActive] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<OrderLite[]>([]);
  const [activeTakeaway, setActiveTakeaway] = useState<OrderLite[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [serveurTab, setServeurTab] = useState<ServeurTab>("tables");
  const [confirmReleaseTable, setConfirmReleaseTable] = useState<string | null>(null);
  const knownPendingIdsRef = useRef<Set<string>>(new Set());
  const pendingBootstrappedRef = useRef(false);

  const { playAlert } = useOrderAlertAudio(soundEnabled);

  const playPendingBeep = useCallback(
    (count = 1) =>
      playAlert(async (ctx) => {
        const cycles = Math.min(2, Math.max(1, count));
        for (let i = 0; i < cycles; i += 1) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = 880;
          const start = ctx.currentTime + i * 0.35;
          const end = start + 0.22;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(end + 0.02);
        }
      }, count),
    [playAlert]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSoundEnabled(readSoundEnabledPreference());
  }, []);

  useEffect(() => {
    writeSoundEnabledPreference(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const count = resolveTableCount(data?.tableCount);
        setTableCount(count);
      })
      .catch(() => setError("Impossible de charger le nombre de tables"));
  }, []);

  const fetchOccupancy = useCallback(async () => {
    try {
      const [ordersRes, occupancyRes] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/kitchen/table-occupancy", { cache: "no-store" }),
      ]);
      if (!ordersRes.ok) return;
      const data = (await ordersRes.json()) as { orders?: OrderLite[] };
      const kitchenStates: Record<string, "ACTIVE" | "READY"> = {};
      const ordersByTable: Record<string, OrderLite[]> = {};
      let takeaway = 0;
      const pending: OrderLite[] = [];
      const activeTakeawayList: OrderLite[] = [];
      for (const o of data.orders ?? []) {
        const isTakeaway = o.type === "TAKEAWAY" || o.tableId === "EMPORTER";
        if (isTakeaway && o.status === "PENDING_PAYMENT") {
          pending.push(o);
          continue;
        }
        if (!isTakeaway) {
          if (!ordersByTable[o.tableId]) ordersByTable[o.tableId] = [];
          ordersByTable[o.tableId].push(o);
        }
        const isOpen = ACTIVE_STATUSES.has(o.status) || o.status === "READY";
        if (!isOpen) continue;
        if (isTakeaway) {
          takeaway += 1;
          activeTakeawayList.push(o);
          continue;
        }
        if (o.status === "READY") {
          kitchenStates[o.tableId] = "READY";
        } else if (kitchenStates[o.tableId] !== "READY") {
          kitchenStates[o.tableId] = "ACTIVE";
        }
      }

      const occupied = new Set<string>();
      const occupancyMeta: Record<string, { occupiedAt: string; lastOrderId?: string | null }> =
        {};
      if (occupancyRes.ok) {
        const occData = (await occupancyRes.json()) as {
          tables?: { tableId: string; occupiedAt: string; lastOrderId?: string | null }[];
        };
        for (const row of occData.tables ?? []) {
          const id = String(row.tableId);
          occupied.add(id);
          occupancyMeta[id] = {
            occupiedAt: row.occupiedAt,
            lastOrderId: row.lastOrderId ?? null,
          };
        }
      }

      for (const list of Object.values(ordersByTable)) {
        list.sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );
      }

      const states: Record<string, TableState> = {};
      for (const [tableId, kitchenState] of Object.entries(kitchenStates)) {
        states[tableId] = kitchenState;
      }
      for (const tableId of occupied) {
        if (states[tableId] !== "READY" && states[tableId] !== "ACTIVE") {
          states[tableId] = "OCCUPIED";
        }
      }
      pending.sort(
        (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      );
      activeTakeawayList.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );

      // Bip + notification quand une nouvelle commande à valider arrive
      const newPending = pending.filter((o) => !knownPendingIdsRef.current.has(o.id));
      pending.forEach((o) => knownPendingIdsRef.current.add(o.id));
      if (pendingBootstrappedRef.current && newPending.length > 0) {
        toast(
          `🧾 ${newPending.length} commande(s) à emporter à valider en caisse`,
          { icon: "🔔", duration: 6000 }
        );
        void playPendingBeep(newPending.length);
      }
      pendingBootstrappedRef.current = true;

      setTableStates(states);
      setTableOrders(ordersByTable);
      setOccupiedTables(occupied);
      setTableOccupancyMeta(occupancyMeta);
      setTakeawayActive(takeaway);
      setPendingOrders(pending);
      setActiveTakeaway(activeTakeawayList);
    } catch {
      // silencieux : l'occupation est un confort, la grille reste utilisable
    }
  }, [playPendingBeep]);

  useEffect(() => {
    fetchOccupancy();
    const id = setInterval(fetchOccupancy, 10000);
    return () => clearInterval(id);
  }, [fetchOccupancy]);

  const printCustomerTicket = useCallback(async (orderId: string) => {
    if (printingId) return;
    setPrintingId(orderId);
    try {
      const res = await fetch("/api/kitchen/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, variant: "customer", force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impression impossible");
      toast.success("Ticket client envoyé à la caisse");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ticket non imprimé");
    } finally {
      setPrintingId(null);
    }
  }, [printingId]);

  const removeTableOrder = useCallback(
    async (orderId: string) => {
      if (removingOrderId) return;
      setRemovingOrderId(orderId);
      try {
        const res = await fetch(`/api/kitchen/orders/${orderId}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Suppression impossible");
        toast.success(data?.action === "canceled" ? "Commande annulée" : "Ticket retiré");
        void fetchOccupancy();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      } finally {
        setRemovingOrderId(null);
      }
    },
    [fetchOccupancy, removingOrderId]
  );

  const releaseTableOccupancy = useCallback(
    async (tableId: string) => {
      if (releasingTable) return;
      setReleasingTable(tableId);
      try {
        const res = await fetch(`/api/kitchen/tables/${tableId}/release`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Libération impossible");
        toast.success(
          data?.released === false
            ? `Table ${tableId} réinitialisée`
            : `Table ${tableId} libérée`
        );
        setSelectedTable(null);
        void fetchOccupancy();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      } finally {
        setReleasingTable(null);
      }
    },
    [fetchOccupancy, releasingTable]
  );

  // Valide (paiement encaissé → part en cuisine) ou refuse une commande à emporter
  const resolvePendingOrder = useCallback(
    async (orderId: string, action: "validate" | "refuse") => {
      if (actingId) return;
      setActingId(orderId);
      try {
        const res = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: orderId,
            status: action === "validate" ? "NEW" : "CANCELED",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.status !== "ok") {
          throw new Error(data?.message || "Action impossible");
        }
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        setRefusingId(null);
        toast.success(action === "validate" ? "Commande envoyée en cuisine" : "Commande refusée");

        void fetchOccupancy();
      } catch (e: any) {
        setError(e?.message || "Erreur lors de la validation");
      } finally {
        setActingId(null);
      }
    },
    [actingId, fetchOccupancy]
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[rgba(190,127,57,0.22)] bg-[rgba(245,239,230,0.9)] backdrop-blur-md">
        <div className="mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-black rounded-xl overflow-hidden px-1">
              <Image
                src="/logo-header.png"
                alt="Asian Nour"
                width={440}
                height={220}
                priority
                className="h-9 w-auto"
              />
            </div>
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[rgba(255,252,247,0.88)] px-3 py-1 text-xs font-medium text-[var(--color-heading)]">
              Mode serveur
            </span>
          </div>
          <Link href="/kitchen" className="btn-ghost text-sm">
            Écran cuisine
          </Link>
        </div>
        <div className="mx-auto flex gap-1 px-4 pb-3 sm:px-6">
          <button
            type="button"
            onClick={() => setServeurTab("tables")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              serveurTab === "tables"
                ? "bg-[var(--color-heading)] text-white shadow-sm"
                : "bg-[rgba(255,252,247,0.88)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-white"
            }`}
          >
            Tables
          </button>
          <button
            type="button"
            onClick={() => setServeurTab("menu")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              serveurTab === "menu"
                ? "bg-[var(--color-heading)] text-white shadow-sm"
                : "bg-[rgba(255,252,247,0.88)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-white"
            }`}
          >
            Carte
          </button>
          <button
            type="button"
            onClick={() => setServeurTab("qrcodes")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              serveurTab === "qrcodes"
                ? "bg-[var(--color-heading)] text-white shadow-sm"
                : "bg-[rgba(255,252,247,0.88)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-white"
            }`}
          >
            QR codes
          </button>
        </div>
      </header>

      <main className="page-shell space-y-8">
        <Toaster position="top-right" />

        {serveurTab === "menu" ? (
          <ServeurMenuPanel />
        ) : serveurTab === "qrcodes" ? (
          <TableQrPanel
            variant="serveur"
            title="QR codes des tables"
            subtitle="Imprimez ou ajoutez des QR codes. Chaque table correspond à une URL /table/N."
            onTableCountSaved={setTableCount}
          />
        ) : (
          <>
        <header className="surface-card-strong px-6 py-6 space-y-2">
          <span className="chip">Prise de commande</span>
          <h1 className="text-3xl font-semibold">Choisissez une table</h1>
          <p className="surface-muted-text text-sm max-w-xl">
            Sélectionnez la table du client pour prendre sa commande depuis la tablette.
            La commande sera envoyée en cuisine exactement comme si elle venait de la table.
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-xs surface-muted-text">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" /> Libre
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Commande en cuisine
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Plats prêts à servir
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Occupée (clients présents)
            </span>
          </div>
        </header>

        {pendingOrders.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-[var(--color-heading)]">
                🧾 À valider en caisse
              </h2>
              <span className="inline-flex items-center rounded-full bg-red-100 border border-red-300 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {pendingOrders.length}
              </span>
            </div>
            <p className="surface-muted-text text-sm -mt-1">
              Commandes à emporter en attente de paiement. Validez après encaissement pour les
              envoyer en cuisine.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {pendingOrders.map((o) => {
                const refusing = refusingId === o.id;
                const busy = actingId === o.id;
                const printing = printingId === o.id;
                return (
                  <article
                    key={o.id}
                    className="surface-card rounded-2xl border-2 border-amber-400 px-5 py-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-[var(--color-accent-strong)]">
                          🥡 {o.code ?? "À emporter"}
                        </div>
                        <div className="text-xs surface-muted-text">
                          Reçue à {formatTime(o.createdAt)}
                        </div>
                      </div>
                      <div className="text-lg font-bold">{formatMoney(o.total ?? 0)}</div>
                    </div>

                    {(o.items?.length ?? 0) > 0 && (
                      <ul className="text-sm space-y-0.5">
                        {o.items!.map((it) => (
                          <li key={it.id}>
                            <span className="font-semibold">{it.qty}×</span> {it.name}
                          </li>
                        ))}
                      </ul>
                    )}

                    {o.comment && (
                      <p className="text-sm rounded-lg bg-[rgba(190,127,57,0.1)] px-3 py-2">
                        💬 {o.comment}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {refusing ? (
                        <>
                          <span className="text-sm font-medium text-red-700 mr-auto">
                            Refuser cette commande ?
                          </span>
                          <button
                            className="btn-ghost text-sm"
                            onClick={() => setRefusingId(null)}
                            disabled={busy}
                          >
                            Non
                          </button>
                          <button
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            onClick={() => resolvePendingOrder(o.id, "refuse")}
                            disabled={busy}
                          >
                            {busy ? "…" : "Oui, refuser"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-ghost text-sm text-red-600"
                            onClick={() => setRefusingId(o.id)}
                            disabled={busy}
                          >
                            ✕ Refuser
                          </button>
                          <button
                            className="btn-soft text-sm"
                            onClick={() => resolvePendingOrder(o.id, "validate")}
                            disabled={busy || printing}
                          >
                            ✓ Payée
                          </button>
                          <button
                            className="btn-primary"
                            onClick={() => void printCustomerTicket(o.id)}
                            disabled={busy || printing}
                          >
                            {printing ? "Envoi…" : "🧾 Ticket client"}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTakeaway.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">
              🥡 Emporter en cours
            </h2>
            <p className="surface-muted-text text-sm -mt-1">
              Réimprimez le ticket client (reçu avec prix) sur l&apos;imprimante caisse.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {activeTakeaway.map((o) => {
                const printing = printingId === o.id;
                return (
                  <article
                    key={o.id}
                    className="surface-card rounded-2xl border border-[var(--color-border)] px-5 py-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-[var(--color-heading)]">
                          {o.code ?? "À emporter"}
                        </div>
                        <div className="text-xs surface-muted-text">
                          {formatTime(o.createdAt)} · {o.status}
                        </div>
                      </div>
                      <div className="font-bold">{formatMoney(o.total ?? 0)}</div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        className="btn-primary text-sm"
                        onClick={() => void printCustomerTicket(o.id)}
                        disabled={printing}
                      >
                        {printing ? "Envoi…" : "🧾 Ticket client"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {error ? (
          <p className="text-red-600">{error}</p>
        ) : tableCount === null ? (
          <p className="surface-muted-text">Chargement…</p>
        ) : (
          <>
            <section className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => {
                const tableId = String(n);
                const state: TableState = tableStates[tableId] ?? "FREE";
                const ring =
                  state === "READY"
                    ? "border-emerald-500 ring-1 ring-emerald-300"
                    : state === "ACTIVE"
                      ? "border-amber-500 ring-1 ring-amber-300"
                      : state === "OCCUPIED"
                        ? "border-indigo-500 ring-1 ring-indigo-300"
                        : "border-[var(--color-border)]";
                const dotClass =
                  state === "READY"
                    ? "bg-emerald-500"
                    : state === "ACTIVE"
                      ? "bg-amber-500"
                      : state === "OCCUPIED"
                        ? "bg-indigo-500"
                        : "bg-gray-300";
                const statusLabel =
                  state === "READY"
                    ? "Prête"
                    : state === "ACTIVE"
                      ? "En cuisine"
                      : state === "OCCUPIED"
                        ? "Occupée"
                        : null;
                const cardClass = `surface-card relative rounded-2xl border px-4 py-6 flex flex-col items-center gap-1 transition hover:border-[var(--color-accent)] hover:shadow-elevated active:translate-y-[1px] w-full ${ring}`;

                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedTable(tableId)}
                    className={cardClass}
                  >
                    <span
                      className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${dotClass}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs uppercase tracking-[0.25em] surface-muted-text">
                      Table
                    </span>
                    <span className="text-3xl font-bold text-[var(--color-heading)]">{n}</span>
                    {statusLabel && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          state === "READY"
                            ? "text-emerald-600"
                            : state === "ACTIVE"
                              ? "text-amber-600"
                              : "text-indigo-600"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>

            <section className="surface-card px-6 py-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)]">
              <div>
                <div className="font-semibold text-lg">
                  Commande à emporter
                  {takeawayActive > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {takeawayActive} en cours
                    </span>
                  )}
                </div>
                <p className="surface-muted-text text-sm">
                  Un code personnage sera attribué automatiquement à la validation.
                </p>
              </div>
              <Link href="/emporter" className="btn-primary">
                🥡 Prendre une commande à emporter
              </Link>
            </section>
          </>
        )}
          </>
        )}
      </main>

      {selectedTable && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fermer"
            onClick={() => setSelectedTable(null)}
          />
          <div className="relative w-full max-w-md surface-card rounded-2xl shadow-elevated border border-[var(--color-border)] p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
            {(() => {
              const state = tableStates[selectedTable] ?? "FREE";
              const allOrders = tableOrders[selectedTable] ?? [];
              const isOccupied = occupiedTables.has(selectedTable);
              const visibleOrders = filterRelevantTableOrders(allOrders, selectedTable, {
                isOccupied,
                occupancy: tableOccupancyMeta[selectedTable] ?? null,
              });
              const hiddenCount = Math.max(0, allOrders.filter((o) => o.status !== "CANCELED").length - visibleOrders.length);
              const releasing = releasingTable === selectedTable;
              const stateLabel =
                state === "READY"
                  ? "Plats prêts à servir"
                  : state === "ACTIVE"
                    ? "Commande en cuisine"
                    : state === "OCCUPIED"
                      ? "Table occupée"
                      : "Libre";

              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] surface-muted-text">
                        Table
                      </div>
                      <h2 className="text-3xl font-bold text-[var(--color-heading)]">
                        {selectedTable}
                      </h2>
                      <p className="text-sm surface-muted-text mt-1">{stateLabel}</p>
                    </div>
                    <button type="button" className="btn-ghost text-sm" onClick={() => setSelectedTable(null)}>
                      Fermer
                    </button>
                  </div>

                  {visibleOrders.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Tickets session ({visibleOrders.length}/{MAX_TABLE_TICKETS})
                        </p>
                        {hiddenCount > 0 && (
                          <span className="text-xs surface-muted-text">
                            {hiddenCount} ancien(s) masqué(s)
                          </span>
                        )}
                      </div>
                      {visibleOrders.map((o) => {
                        const printing = printingId === o.id;
                        const removing = removingOrderId === o.id;
                        const canRemove =
                          o.status === "SERVED" ||
                          o.status === "NEW" ||
                          o.status === "IN_PROGRESS" ||
                          o.status === "READY";
                        return (
                          <article
                            key={o.id}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-4 py-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="font-semibold">{formatTime(o.createdAt)} · {o.status}</span>
                              <span className="font-bold">{formatMoney(o.total ?? 0)}</span>
                            </div>
                            {(o.items?.length ?? 0) > 0 && (
                              <ul className="text-xs space-y-0.5 surface-muted-text">
                                {o.items!.slice(0, 4).map((it) => (
                                  <li key={it.id}>
                                    {it.qty}× {it.name}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-primary flex-1 text-sm py-2"
                                onClick={() => void printCustomerTicket(o.id)}
                                disabled={printing || removing}
                              >
                                {printing ? "Envoi…" : "🧾 Ticket client"}
                              </button>
                              {canRemove && (
                                <button
                                  type="button"
                                  className="btn-ghost text-sm px-3 py-2 text-red-600 shrink-0"
                                  onClick={() => void removeTableOrder(o.id)}
                                  disabled={printing || removing}
                                  title="Retirer de la liste"
                                >
                                  {removing ? "…" : "✕"}
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm surface-muted-text">
                      Aucun ticket pertinent pour cette session. Les anciennes commandes sont masquées
                      — libérez la table quand les clients partent.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    <Link href={`/table/${selectedTable}?staff=1&order=1`} className="btn-soft w-full text-center py-2.5">
                      Prendre / compléter la commande
                    </Link>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
                      onClick={() => setConfirmReleaseTable(selectedTable)}
                      disabled={releasing}
                    >
                      {releasing ? "Libération…" : "Libérer la table (clients partis)"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      <ConfirmActionModal
        open={confirmReleaseTable !== null}
        tone="danger"
        title={`Libérer la table ${confirmReleaseTable ?? ""} ?`}
        message="Confirmez que les clients sont partis. La table sera réinitialisée pour le prochain service."
        confirmLabel="Libérer la table"
        loading={releasingTable !== null}
        onCancel={() => setConfirmReleaseTable(null)}
        onConfirm={() => {
          if (confirmReleaseTable) void releaseTableOccupancy(confirmReleaseTable);
          setConfirmReleaseTable(null);
        }}
      />
    </>
  );
}

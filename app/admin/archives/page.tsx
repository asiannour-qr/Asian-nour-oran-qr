"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { formatRestaurantTime } from "@/lib/restaurant-time";
import { formatMoney } from "@/lib/currency";

type ArchiveItem = {
  id: string;
  tableId: string;
  status: string;
  type?: string | null;
  code?: string | null;
  total: number;
  comment?: string | null;
  createdAt: string;
  guestNames?: Record<string, string> | null;
  items: { id: string; name: string; qty: number; price?: number | null; personId?: string | null }[];
};

type ArchiveDay = {
  dateKey: string;
  dateLabel: string;
  orders: ArchiveItem[];
};

type ArchiveMonth = {
  monthKey: string;
  monthLabel: string;
  orderCount: number;
  days: ArchiveDay[];
};

function orderTitle(o: ArchiveItem): string {
  if (o.type === "TAKEAWAY" || o.tableId === "EMPORTER") {
    return `Emporter ${o.code ?? ""}`.trim();
  }
  return `Table ${o.tableId}`;
}


export default function AdminArchivesPage() {
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders/archive?days=120", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Chargement impossible");
      const list = (data.months ?? []) as ArchiveMonth[];
      setMonths(list);
      if (list.length > 0) {
        setOpenMonth((prev) => prev ?? list[0].monthKey);
        const firstDay = list[0].days[0]?.dateKey ?? null;
        setOpenDay((prev) => prev ?? firstDay);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const totalOrders = useMemo(
    () => months.reduce((sum, m) => sum + m.orderCount, 0),
    [months]
  );

  async function printOrder(orderId: string, variant: "kitchen" | "customer") {
    const key = `${orderId}:${variant}`;
    if (printingKey) return;
    setPrintingKey(key);
    try {
      const res = await fetch("/api/admin/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, variant, force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Impression échouée");
      toast.success(variant === "customer" ? "Ticket client envoyé" : "Ticket cuisine envoyé");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPrintingKey(null);
    }
  }

  return (
    <main className="page-shell space-y-8 max-w-5xl">
      <Toaster position="top-right" />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--color-heading)]">Archives des tickets</h1>
        <p className="surface-muted-text text-sm max-w-2xl">
          Historique des commandes classées par mois puis par jour. Réimprimez un ticket cuisine ou client
          pour contrôle ou réclamation client.
        </p>
      </header>

      <section className="rounded-2xl border border-black/10 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] surface-muted-text">Période</p>
          <p className="font-semibold text-[var(--color-heading)]">
            {loading ? "Chargement…" : `${totalOrders} ticket(s) sur 120 jours`}
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={() => void loadArchives()} disabled={loading}>
          Rafraîchir
        </button>
      </section>

      {loading ? (
        <p className="surface-muted-text text-sm">Chargement des archives…</p>
      ) : months.length === 0 ? (
        <p className="surface-muted-text text-sm">Aucune commande archivée.</p>
      ) : (
        <div className="space-y-3">
          {months.map((month) => {
            const monthOpen = openMonth === month.monthKey;
            return (
              <section
                key={month.monthKey}
                className="rounded-2xl border border-black/10 bg-[rgba(255,252,247,0.92)] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-black/[0.03] transition"
                  onClick={() => setOpenMonth(monthOpen ? null : month.monthKey)}
                >
                  <div>
                    <div className="text-lg font-semibold capitalize text-[var(--color-heading)]">
                      {month.monthLabel}
                    </div>
                    <div className="text-xs surface-muted-text">
                      {month.orderCount} ticket(s) · {month.days.length} jour(s)
                    </div>
                  </div>
                  <span className="text-xl font-light surface-muted-text">{monthOpen ? "−" : "+"}</span>
                </button>

                {monthOpen && (
                  <div className="border-t border-black/5 px-3 pb-3 space-y-2">
                    {month.days.map((day) => {
                      const dayOpen = openDay === day.dateKey;
                      return (
                        <div key={day.dateKey} className="rounded-xl border border-black/8 bg-white overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition"
                            onClick={() => setOpenDay(dayOpen ? null : day.dateKey)}
                          >
                            <div>
                              <div className="font-medium capitalize text-[var(--color-heading)]">
                                {day.dateLabel}
                              </div>
                              <div className="text-xs surface-muted-text">
                                {day.orders.length} ticket(s)
                              </div>
                            </div>
                            <span className="text-lg surface-muted-text">{dayOpen ? "−" : "+"}</span>
                          </button>

                          {dayOpen && (
                            <ul className="divide-y divide-black/5 border-t border-black/5">
                              {day.orders.map((o) => {
                                const kitchenBusy = printingKey === `${o.id}:kitchen`;
                                const customerBusy = printingKey === `${o.id}:customer`;
                                return (
                                  <li key={o.id} className="px-4 py-3 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <div className="font-semibold">{orderTitle(o)}</div>
                                        <div className="text-xs surface-muted-text">
                                          {formatRestaurantTime(o.createdAt)} · {o.status} · {formatMoney(o.total)}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="btn-ghost text-xs"
                                          disabled={Boolean(printingKey)}
                                          onClick={() => void printOrder(o.id, "kitchen")}
                                        >
                                          {kitchenBusy ? "…" : "🍜 Cuisine"}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-soft text-xs"
                                          disabled={Boolean(printingKey)}
                                          onClick={() => void printOrder(o.id, "customer")}
                                        >
                                          {customerBusy ? "…" : "🧾 Client"}
                                        </button>
                                      </div>
                                    </div>
                                    <ul className="text-xs surface-muted-text space-y-0.5">
                                      {o.items.slice(0, 6).map((it) => (
                                        <li key={it.id}>
                                          {it.qty}× {it.name}
                                        </li>
                                      ))}
                                      {o.items.length > 6 && (
                                        <li>… +{o.items.length - 6} ligne(s)</li>
                                      )}
                                    </ul>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

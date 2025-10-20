"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { guestNameFromMap } from "@/lib/guest-name-utils";

type OrderItem = {
  id: string;
  name: string;
  qty: number;
  price?: number | null;
  personId?: string | null;
  guest?: string | null;
  modifiers?: string[] | null;
};
type Order = {
  id: string;
  tableId: string;
  total: number;
  comment?: string | null;
  status: "NEW" | "IN_PROGRESS" | "READY" | "SERVED" | "CANCELED" | string;
  createdAt: string; // ISO string
  items: OrderItem[];
  guestNames?: Record<string, string> | null;
};

const AUTO_PRINT_STORAGE_KEY = "kitchen:autoPrint";
const PRINT_MODE = (process.env.NEXT_PUBLIC_PRINT_MODE ?? "preview").toLowerCase();
const IS_AUTO_PRINT_MODE = PRINT_MODE === "auto";
function statusBadgeClasses(s: string) {
  switch (s) {
    case "NEW": return "bg-red-600 text-white";
    case "IN_PROGRESS": return "bg-amber-500 text-black";
    case "READY": return "bg-emerald-600 text-white";
    case "SERVED": return "bg-gray-400 text-black";
    case "CANCELED": return "bg-gray-800 text-white";
    default: return "bg-slate-600 text-white";
  }
}

export default function KitchenPage() {
  const SOUND_ENABLED = process.env.NEXT_PUBLIC_KITCHEN_SOUND_ENABLED !== "false";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [hideServed, setHideServed] = useState(true);
  const lastFetch = useRef<string>("—");
  const knownIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoPrintRef = useRef(false);
  const printedAutoIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const pendingPrintsRef = useRef<Order[]>([]);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const Ctor = (window.AudioContext ?? (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new Ctor();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore resume errors (browser restrictions)
      }
    }
    return ctx;
  }, []);

  const playBeep = useCallback(
    async (count: number) => {
      if (!SOUND_ENABLED) return;
      const ctx = await ensureAudioContext();
      if (!ctx) return;
      const bursts = Math.max(1, Math.min(3, Math.floor(count)));
      for (let i = 0; i < bursts; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        const start = ctx.currentTime + i * 0.32;
        const end = start + 0.3;
        osc.frequency.setValueAtTime(900, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.5, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      }
    },
    [ensureAudioContext]
  );

  const formatPrice = useCallback((cents: number) => `${(cents / 100).toFixed(2)} €`, []);

const formatDate = useCallback((iso: string | Date | null | undefined) => {
    if (!iso) return "—";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("fr-FR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  }, []);

  const formatTime = useCallback((iso: string | Date | null | undefined) => {
    if (!iso) return "—";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

const escapeHtml = useCallback((value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }, []);

  const buildTicketHtml = useCallback((order: {
    tableNumber?: string | null;
    code?: string | null;
    createdAt?: string | Date | null;
    status?: string | null;
    items: OrderItem[];
    comment?: string | null;
    total: number;
    guestNames?: Record<string, string> | null;
  }) => {
    const groups = order.items.reduce<Record<string, OrderItem[]>>((acc, item) => {
      const raw = item.personId ?? item.guest ?? "P1";
      const key = raw && raw.trim() ? raw.trim() : "P1";
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    const groupSections = Object.entries(groups)
      .map(([guest, items]) => {
        const subtotal = items.reduce((sum, it) => {
          const price = Number.isFinite(it?.price) ? Number(it.price) : 0;
          const qty = Number.isFinite(it?.qty) ? Number(it.qty) : 0;
          return sum + price * qty;
        }, 0);

        const displayGuest = guestNameFromMap(order.guestNames, guest);

        const lines = items
          .map((it) => {
            const modifiers = Array.isArray(it?.modifiers)
              ? (it.modifiers as (string | null | undefined)[]).filter((m): m is string => Boolean(m))
              : [];
            const modifiersHtml = modifiers.length
              ? modifiers.map((m) => `<div class="small muted mod">• ${escapeHtml(m)}</div>`).join("")
              : "";
            return `
              <div class="row line item-line"><span>${escapeHtml(String(it.qty ?? 0))} × ${escapeHtml(it.name ?? "")}</span><span></span></div>
              ${modifiersHtml}
            `;
          })
          .join("");

        return `
          <div class="ticket-section guest-block">
            <div class="hr"></div>
            <div class="guest-header">— ${escapeHtml(displayGuest.toUpperCase())} —</div>
            ${lines}
            <div class="row small subtotal bold"><span>Sous-total</span><span>${escapeHtml(formatPrice(subtotal))}</span></div>
          </div>
        `;
      })
      .join("");

    const commentSection = order.comment
      ? `<div class="ticket-section comment-block"><div class="hr"></div><div class="small label muted">Note :</div><div class="small">${escapeHtml(order.comment)}</div></div>`
      : "";

    return `
      <div class="ticket-section header-section">
        <div class="center bold title">ASIAN NOUR</div>
        <div class="center small muted">Cuisine – Ticket</div>
        <div class="row small label"><span>Table</span><span>${escapeHtml(order.tableNumber ?? "-")}</span></div>
        <div class="row small label"><span>Commande</span><span>${escapeHtml(order.code ?? "-")}</span></div>
        <div class="row small label"><span>Date</span><span>${escapeHtml(formatDate(order.createdAt))}</span></div>
        <div class="row small label"><span>Heure</span><span>${escapeHtml(formatTime(order.createdAt))}</span></div>
        <div class="row small label"><span>Statut</span><span>${escapeHtml(order.status ?? "NEW")}</span></div>
      </div>
      ${groupSections}
      ${commentSection}
      <div class="ticket-section footer-section">
        <div class="hr"></div>
        <div class="row bold total"><span>Total</span><span>${escapeHtml(formatPrice(order.total))}</span></div>
        <div class="small muted" style="margin-top:8px">Merci pour votre commande !</div>
      </div>
    `;
  }, [escapeHtml, formatDate, formatPrice, formatTime]);

  const handlePrint = useCallback((order: Order) => {
    if (typeof window === "undefined") return;
    console.debug("[print] start", order.id);
    const ticket = document.querySelector(`.ticket-preview[data-ticket-order="${order.id}"]`) as HTMLElement | null;
    const root = document.getElementById("print-root");
    if (!ticket || !root) {
      console.error("[print] ticket introuvable pour", order.id);
      alert("Ticket introuvable pour cette commande.");
      return;
    }

    root.innerHTML = `<div class="ticket">${ticket.innerHTML}</div>`;
    document.documentElement.classList.add("printing");

    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    (async () => {
      await raf();
      await raf();
      console.debug(
        "[print] ready to print",
        !!root.querySelector(".ticket"),
        document.documentElement.classList.contains("printing")
      );
      window.print();
    })();

    const afterPrint = () => {
      console.debug("[print] afterprint cleanup");
      root.innerHTML = "";
      document.documentElement.classList.remove("printing");
    };

    window.addEventListener("afterprint", afterPrint, { once: true });
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) throw new Error("GET /api/orders a échoué");

      const data = (await res.json()) as { orders: Order[] };
      const list = (data.orders ?? [])
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const incoming = list.filter((o) => !knownIds.current.has(o.id));
      if (incoming.length > 0) {
        incoming.forEach((o) => knownIds.current.add(o.id));
        toast.success(`${incoming.length} nouvelle(s) commande(s)`);
        void playBeep(incoming.length);

        if (autoPrintRef.current && bootstrappedRef.current && IS_AUTO_PRINT_MODE) {
          incoming.forEach((order) => {
            if (printedAutoIdsRef.current.has(order.id)) return;
            printedAutoIdsRef.current.add(order.id);
            pendingPrintsRef.current.push(order);
          });
        }
      } else if (knownIds.current.size === 0) {
        list.forEach((o) => knownIds.current.add(o.id));
      }

      if (!bootstrappedRef.current) {
        bootstrappedRef.current = true;
      }

      const shown = hideServed ? list.filter((o) => o.status !== "SERVED") : list;
      setOrders(shown);
      lastFetch.current = new Date().toISOString().slice(11, 19);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de rafraîchissement");
    } finally {
      setLoading(false);
    }
  }, [handlePrint, hideServed, playBeep]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let root = document.getElementById("print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "print-root";
      root.setAttribute("aria-hidden", "true");
      document.body.appendChild(root);
    } else if (root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const count = document.querySelectorAll(".ticket-preview").length;
    console.debug("[print] tickets cachés présents:", count);
  }, [orders]);

  useEffect(() => {
    if (!IS_AUTO_PRINT_MODE || !pendingPrintsRef.current.length) return;
    const queue = [...pendingPrintsRef.current];
    pendingPrintsRef.current = [];
    queue.forEach((order) => {
      setTimeout(() => handlePrint(order), 0);
    });
  }, [orders, handlePrint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(AUTO_PRINT_STORAGE_KEY);
    if (stored === "1") {
      setAutoPrint(true);
      autoPrintRef.current = true;
    }
  }, []);

  useEffect(() => {
    autoPrintRef.current = autoPrint;
    if (typeof window === "undefined") return;
    if (autoPrint) {
      window.localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
      printedAutoIdsRef.current.clear();
    }
  }, [autoPrint]);

  useEffect(() => {
    if (SOUND_ENABLED) void ensureAudioContext();
    const handler = () => {
      void ensureAudioContext();
      document.removeEventListener("pointerdown", handler);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [SOUND_ENABLED, ensureAudioContext]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(fetchOrders, 5000);
    return () => clearInterval(id);
  }, [auto, fetchOrders]);

  async function updateStatus(id: string, next: string) {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "PATCH échoué");
      }
      toast.success(`Statut → ${next}`);
      fetchOrders();
    } catch (e: any) {
      toast.error(e?.message || "Erreur mise à jour");
    }
  }

  return (
    <>
      <main className="page-shell max-w-6xl">
        <Toaster position="top-right" />
        <section className="surface-card-strong px-6 py-6 mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold flex-1 min-w-[220px]">Cuisine — Commandes</h1>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={fetchOrders} className="btn-ghost" disabled={loading}>
              {loading ? "Chargement…" : "Rafraîchir"}
            </button>
            <button onClick={() => setAuto((v) => !v)} className="btn-soft">
              Auto-refresh&nbsp;: {auto ? "ON" : "OFF"}
            </button>
            <button onClick={() => setHideServed((v) => !v)} className="btn-soft">
              Cacher “Servies”&nbsp;: {hideServed ? "ON" : "OFF"}
            </button>
            <label className="flex items-center gap-2 text-sm font-medium surface-muted-text">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
              Auto-print à l’arrivée
            </label>
            <span className="surface-muted-text text-sm">Dernier fetch&nbsp;: {lastFetch.current}</span>
          </div>
        </section>

        {orders.length === 0 ? (
          <p className="surface-muted-text">Aucune commande pour le moment.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {orders.map((o) => {
              const ticketInnerHtml = buildTicketHtml({
                tableNumber: o.tableId,
                code: o.id.slice(0, 8).toUpperCase(),
                createdAt: o.createdAt,
                status: o.status ?? "NEW",
                items: o.items,
                comment: o.comment ?? "",
                total: o.total,
                guestNames: o.guestNames,
              });

              return (
                <div key={o.id} className="relative">
                  <div className="surface-card px-6 py-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold tracking-wide">Table {o.tableId}</div>
                        <div className="text-xs surface-muted-text uppercase tracking-[0.28em]">
                          Total {(o.total / 100).toFixed(2)} €
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${statusBadgeClasses(o.status)}`}>
                    {o.status}
                  </span>
                </div>

                {o.comment && (
                  <div className="text-sm surface-panel px-4 py-3 rounded-2xl border border-[rgba(120,110,98,0.18)]">
                    <span className="font-medium uppercase tracking-[0.22em] text-xs block mb-1 surface-muted-text">
                      Commentaire
                    </span>
                    <span className="italic">{o.comment}</span>
                  </div>
                )}

                <ul className="space-y-2 text-sm">
                  {o.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-3 border-b border-[rgba(120,110,98,0.12)] pb-2 last:border-0"
                    >
                      <div className="flex-1">
                        <div className="font-medium leading-snug">
                          {`${it.qty ?? 1} × ${it.name}`}
                        </div>
                        <div className="text-xs surface-muted-text">
                          {guestNameFromMap(o.guestNames, it.personId ?? "P1")}
                        </div>
                      </div>
                      <span className="text-xs surface-muted-text">
                        {((it.price ?? 0) / 100).toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    data-order-id={o.id}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePrint(o);
                    }}
                    className="btn-ghost"
                    title="Imprimer un ticket pour cette commande"
                  >
                    Imprimer
                  </button>
                  {o.status !== "IN_PROGRESS" && (
                    <button
                      onClick={() => updateStatus(o.id, "IN_PROGRESS")}
                      className="btn-soft"
                    >
                      Démarrer
                    </button>
                  )}
                  {o.status !== "READY" && (
                    <button
                      onClick={() => updateStatus(o.id, "READY")}
                      className="btn-soft"
                    >
                      Prête
                    </button>
                  )}
                  {o.status !== "SERVED" && (
                    <button
                      onClick={() => updateStatus(o.id, "SERVED")}
                      className="btn-primary"
                    >
                      Servie
                    </button>
                  )}
                </div>
                  </div>
                  <div
                    className="ticket ticket-preview"
                    data-ticket-order={o.id}
                    style={{ position: "absolute", left: "-9999px", top: 0, opacity: 0, pointerEvents: "none", width: "72mm" }}
                    dangerouslySetInnerHTML={{ __html: ticketInnerHtml }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

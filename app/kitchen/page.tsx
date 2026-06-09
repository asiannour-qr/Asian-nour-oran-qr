"use client";

import Image from "next/image";
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
  type?: string | null;
  code?: string | null;
  createdAt: string; // ISO string
  items: OrderItem[];
  guestNames?: Record<string, string> | null;
};

function isTakeaway(order: { type?: string | null }): boolean {
  return order.type === "TAKEAWAY";
}

function orderLocationLabel(order: { type?: string | null; code?: string | null; tableId: string }): string {
  if (isTakeaway(order)) return `À EMPORTER — ${order.code ?? "?"}`;
  return `Table ${order.tableId}`;
}

const AUTO_PRINT_STORAGE_KEY = "kitchen:autoPrint";
const PRINT_MODE = (process.env.NEXT_PUBLIC_PRINT_MODE ?? "preview").toLowerCase();
const IS_BROWSER_AUTO_PRINT_MODE = PRINT_MODE === "auto";
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [hideServed, setHideServed] = useState(true);
  const [printerConfigured, setPrinterConfigured] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [restaurantInfo, setRestaurantInfo] = useState<{ restaurantName: string; address: string | null; phone: string | null }>({
    restaurantName: "Asian Nour",
    address: null,
    phone: null,
  });
  const lastFetch = useRef<string>("—");
  const knownIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoPrintRef = useRef(false);
  const printerConfiguredRef = useRef(false);
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
      if (!soundEnabled) return;
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
    [ensureAudioContext, soundEnabled]
  );

  const formatPrice = useCallback((cents: number) => `${Math.round(cents / 100)} DZD`, []);

const formatDate = useCallback((iso: string | Date | null | undefined) => {
    if (!iso) return "—";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("fr-FR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Africa/Algiers",
    });
  }, []);

  const formatTime = useCallback((iso: string | Date | null | undefined) => {
    if (!iso) return "—";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Algiers",
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

  const groupItemsByGuest = useCallback((order: { items: OrderItem[] }) => {
    return order.items.reduce<Record<string, OrderItem[]>>((acc, item) => {
      const raw = item.personId ?? item.guest ?? "P1";
      const key = raw && raw.trim() ? raw.trim() : "P1";
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, []);

  // Libellé convive cuisine : nom réel ou « Convive N »
  const kitchenGuestLabel = useCallback(
    (guestNames: Record<string, string> | null | undefined, personId: string) => {
      const match = /^P?(\d+)$/i.exec(personId.trim());
      const index = match ? Number(match[1]) : NaN;
      if (Number.isInteger(index) && index > 0) {
        const custom = guestNames?.[String(index)];
        if (custom && custom.trim()) return custom.trim();
        return `Convive ${index}`;
      }
      return personId;
    },
    []
  );

  // Articles consolidés (nom + prix) pour le reçu client
  const consolidateItems = useCallback((items: OrderItem[]) => {
    const map = new Map<string, { name: string; qty: number; price: number }>();
    for (const it of items) {
      const price = Number.isFinite(it?.price) ? Number(it.price) : 0;
      const qty = Number.isFinite(it?.qty) ? Number(it.qty) : 0;
      const key = `${it.name}|${price}`;
      const ex = map.get(key);
      if (ex) ex.qty += qty;
      else map.set(key, { name: it.name ?? "", qty, price });
    }
    return Array.from(map.values());
  }, []);

  /** Ticket CUISINE : sans prix, gros articles, commentaires en avant. */
  const buildKitchenTicketHtml = useCallback((order: {
    tableNumber?: string | null;
    code?: string | null;
    takeaway?: boolean;
    createdAt?: string | Date | null;
    items: OrderItem[];
    comment?: string | null;
    guestNames?: Record<string, string> | null;
  }) => {
    const groups = groupItemsByGuest(order);

    const groupSections = Object.entries(groups)
      .map(([guest, items]) => {
        const displayGuest = kitchenGuestLabel(order.guestNames, guest);
        const lines = items
          .map((it) => {
            const modifiers = Array.isArray(it?.modifiers)
              ? (it.modifiers as (string | null | undefined)[]).filter((m): m is string => Boolean(m))
              : [];
            const modifiersHtml = modifiers.length
              ? modifiers.map((m) => `<div class="small muted mod">– ${escapeHtml(m)}</div>`).join("")
              : "";
            return `
              <div class="kitchen-item">${escapeHtml(String(it.qty ?? 0))} × ${escapeHtml(it.name ?? "")}</div>
              ${modifiersHtml}
            `;
          })
          .join("");

        return `
          <div class="ticket-section guest-block">
            <div class="hr"></div>
            <div class="guest-header">${escapeHtml(displayGuest.toUpperCase())}</div>
            ${lines}
          </div>
        `;
      })
      .join("");

    const commentSection = order.comment
      ? `<div class="ticket-section comment-block"><div class="hr"></div><div class="center bold">*** NOTE ***</div><div class="kitchen-note">${escapeHtml(order.comment)}</div></div>`
      : "";

    const headerHtml = order.takeaway
      ? `
        <div class="center bold title">CUISINE</div>
        <div class="center bold title">À EMPORTER</div>
        <div class="center bold kitchen-code">${escapeHtml(order.code ?? "-")}</div>
        <div class="row small muted"><span>Commande</span><span>${escapeHtml(formatTime(order.createdAt))}</span></div>
      `
      : `
        <div class="center bold title">CUISINE</div>
        <div class="row bold kitchen-meta"><span>Table ${escapeHtml(order.tableNumber ?? "-")}</span><span>${escapeHtml(formatTime(order.createdAt))}</span></div>
        <div class="small muted">Cmd ${escapeHtml(order.code ?? "-")}</div>
      `;

    return `
      <div class="ticket-section header-section">
        ${headerHtml}
      </div>
      ${groupSections}
      ${commentSection}
      <div class="hr"></div>
    `;
  }, [escapeHtml, formatTime, groupItemsByGuest, kitchenGuestLabel]);

  /** Ticket CLIENT : reçu normalisé complet (infos resto + prix + total). */
  const buildCustomerTicketHtml = useCallback((order: {
    tableNumber?: string | null;
    code?: string | null;
    takeaway?: boolean;
    createdAt?: string | Date | null;
    items: OrderItem[];
    comment?: string | null;
    total: number;
    guestNames?: Record<string, string> | null;
  }) => {
    const itemsHtml = consolidateItems(order.items)
      .map(
        (it) =>
          `<div class="row line item-line"><span>${escapeHtml(String(it.qty))} × ${escapeHtml(it.name)}</span><span>${escapeHtml(formatPrice(it.price * it.qty))}</span></div>`
      )
      .join("");

    const addressHtml = restaurantInfo.address
      ? `<div class="center small">${escapeHtml(restaurantInfo.address)}</div>`
      : "";
    const phoneHtml = restaurantInfo.phone
      ? `<div class="center small">Tél : ${escapeHtml(restaurantInfo.phone)}</div>`
      : "";
    const commentSection = order.comment
      ? `<div class="ticket-section comment-block"><div class="hr"></div><div class="small label muted">Note :</div><div class="small">${escapeHtml(order.comment)}</div></div>`
      : "";

    const locationRow = order.takeaway
      ? `<div class="row small label"><span>À emporter</span><span>${escapeHtml(order.code ?? "-")}</span></div>`
      : `
        <div class="row small label"><span>Table</span><span>${escapeHtml(order.tableNumber ?? "-")}</span></div>
        <div class="row small label"><span>Commande</span><span>${escapeHtml(order.code ?? "-")}</span></div>
      `;

    const takeawayNotice = order.takeaway
      ? `<div class="ticket-section footer-section"><div class="hr"></div><div class="center small bold">Présentez ce code à l'hôte de caisse</div><div class="center small">pour valider votre ticket après paiement.</div></div>`
      : "";

    return `
      <div class="ticket-section header-section">
        <div class="center bold title">${escapeHtml(restaurantInfo.restaurantName)}</div>
        ${addressHtml}
        ${phoneHtml}
        <div class="hr"></div>
        ${locationRow}
        <div class="row small label"><span>Date</span><span>${escapeHtml(formatDate(order.createdAt))}</span></div>
        <div class="row small label"><span>Heure</span><span>${escapeHtml(formatTime(order.createdAt))}</span></div>
        <div class="hr"></div>
      </div>
      <div class="ticket-section">
        ${itemsHtml}
      </div>
      <div class="ticket-section">
        <div class="hr"></div>
        <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatPrice(order.total))}</span></div>
      </div>
      ${commentSection}
      ${takeawayNotice}
      <div class="ticket-section footer-section">
        <div class="hr"></div>
        <div class="small muted">Merci pour votre visite !</div>
        <div class="small muted">${escapeHtml(restaurantInfo.restaurantName)}</div>
      </div>
    `;
  }, [escapeHtml, formatDate, formatPrice, formatTime, consolidateItems, restaurantInfo]);

  const handleBrowserPrint = useCallback((order: Order, variant: "kitchen" | "customer" = "kitchen") => {
    if (typeof window === "undefined") return;
    console.debug("[print/browser] start", order.id, variant);
    const root = document.getElementById("print-root");
    if (!root) {
      console.error("[print/browser] print-root introuvable");
      toast.error("Impression indisponible.");
      return;
    }

    const takeaway = isTakeaway(order);
    const ticketData = {
      tableNumber: order.tableId,
      code: takeaway ? (order.code ?? "-") : order.id.slice(0, 8).toUpperCase(),
      takeaway,
      createdAt: order.createdAt,
      items: order.items,
      comment: order.comment ?? "",
      total: order.total,
      guestNames: order.guestNames,
    };
    const innerHtml =
      variant === "customer"
        ? buildCustomerTicketHtml(ticketData)
        : buildKitchenTicketHtml(ticketData);

    root.innerHTML = `<div class="ticket ticket-${variant}">${innerHtml}</div>`;
    document.documentElement.classList.add("printing");

    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    (async () => {
      await raf();
      await raf();
      window.print();
    })();

    const afterPrint = () => {
      root.innerHTML = "";
      document.documentElement.classList.remove("printing");
    };

    window.addEventListener("afterprint", afterPrint, { once: true });
  }, [buildCustomerTicketHtml, buildKitchenTicketHtml]);

  const printOrderViaTcp = useCallback(async (order: Order, variant: "kitchen" | "customer" = "kitchen", silent = false) => {
    setPrintingOrderId(order.id);
    try {
      const res = await fetch("/api/kitchen/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, variant }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (!silent) {
        const label = variant === "customer" ? "Ticket client" : "Ticket cuisine";
        toast.success(`${label} envoyé — ${orderLocationLabel(order)}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur impression";
      console.error("[print/tcp]", order.id, message);
      toast.error(message);
    } finally {
      setPrintingOrderId((current) => (current === order.id ? null : current));
    }
  }, []);

  const handlePrint = useCallback(
    (order: Order, variant: "kitchen" | "customer" = "kitchen") => {
      if (printerConfiguredRef.current) {
        void printOrderViaTcp(order, variant);
        return;
      }
      handleBrowserPrint(order, variant);
    },
    [handleBrowserPrint, printOrderViaTcp]
  );

  const queueAutoPrint = useCallback((order: Order) => {
    if (printedAutoIdsRef.current.has(order.id)) return;
    printedAutoIdsRef.current.add(order.id);
    pendingPrintsRef.current.push(order);
  }, []);

  const fetchPrinterStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen/printer", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const configured = Boolean(data?.configured);
      printerConfiguredRef.current = configured;
      setPrinterConfigured(configured);
    } catch {
      printerConfiguredRef.current = false;
      setPrinterConfigured(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPrinterStatus();
      const res = await fetch("/api/orders", {
        cache: "no-store",
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error || errorData?.message || `Erreur HTTP ${res.status}`;
        throw new Error(`Impossible de récupérer les commandes: ${message}`);
      }

      const data = (await res.json()) as { orders: Order[]; error?: string };
      if (data.error) {
        throw new Error(`Erreur serveur: ${data.error}`);
      }
      const list = (data.orders ?? [])
        // Les commandes à emporter non validées en caisse ne doivent pas
        // arriver en cuisine (ni beep, ni impression) tant que l'hôte de
        // caisse n'a pas confirmé le paiement.
        .filter((o) => o.status !== "PENDING_PAYMENT")
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const incoming = list.filter((o) => !knownIds.current.has(o.id));
      if (incoming.length > 0) {
        incoming.forEach((o) => knownIds.current.add(o.id));
        toast.success(`${incoming.length} nouvelle(s) commande(s)`);
        void playBeep(incoming.length);

        if (bootstrappedRef.current) {
          incoming.forEach((order) => {
            if (printerConfiguredRef.current) {
              queueAutoPrint(order);
            } else if (autoPrintRef.current && IS_BROWSER_AUTO_PRINT_MODE) {
              queueAutoPrint(order);
            }
          });
        }
      } else if (knownIds.current.size === 0) {
        list.forEach((o) => knownIds.current.add(o.id));
      }

      if (!bootstrappedRef.current) {
        bootstrappedRef.current = true;
      }

      const shown = hideServed
        ? list.filter((o) => o.status !== "SERVED" && o.status !== "CANCELED")
        : list;
      setOrders(shown);
      lastFetch.current = new Date().toISOString().slice(11, 19);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de rafraîchissement");
    } finally {
      setLoading(false);
    }
  }, [fetchPrinterStatus, hideServed, playBeep, queueAutoPrint]);

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
    if (!pendingPrintsRef.current.length) return;
    const queue = [...pendingPrintsRef.current];
    pendingPrintsRef.current = [];
    queue.forEach((order, index) => {
      setTimeout(() => {
        if (printerConfiguredRef.current) {
          void printOrderViaTcp(order, "kitchen", true);
        } else {
          handleBrowserPrint(order, "kitchen");
        }
      }, index * 300);
    });
  }, [orders, handleBrowserPrint, printOrderViaTcp]);

  // Load settings from DB on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: { kitchenSoundEnabled?: boolean; autoPrintEnabled?: boolean; restaurantName?: string; address?: string | null; phone?: string | null }) => {
        setSoundEnabled(s.kitchenSoundEnabled !== false);
        setRestaurantInfo({
          restaurantName: s.restaurantName || "Asian Nour",
          address: s.address ?? null,
          phone: s.phone ?? null,
        });
        // Only apply DB autoPrint default if no local override
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem(AUTO_PRINT_STORAGE_KEY);
          if (stored === null) {
            setAutoPrint(s.autoPrintEnabled === true);
            autoPrintRef.current = s.autoPrintEnabled === true;
          }
        }
      })
      .catch(() => {});
  }, []);

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
    if (!soundEnabled) return;
    void ensureAudioContext();
    const handler = () => {
      void ensureAudioContext();
      document.removeEventListener("pointerdown", handler);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ensureAudioContext]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(fetchOrders, 5000);
    return () => clearInterval(id);
  }, [auto, fetchOrders]);

  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [canceling, setCanceling] = useState(false);

  async function confirmCancelOrder() {
    if (!cancelTarget || canceling) return;
    setCanceling(true);
    try {
      await updateStatus(cancelTarget.id, "CANCELED");
      setCancelTarget(null);
    } finally {
      setCanceling(false);
    }
  }

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
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#1a1410]/95 backdrop-blur-xl shadow-[0_2px_16px_rgba(26,20,16,0.22)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="bg-black rounded-xl overflow-hidden shrink-0 px-1">
            <Image
              src="/logo-header.png"
              alt="Asian Nour"
              width={440}
              height={220}
              priority
              className="h-11 w-auto"
            />
          </div>
          <span className="text-[#d5bfa3] text-sm font-medium tracking-widest uppercase opacity-80 hidden sm:block">
            Cuisine
          </span>
        </div>
      </header>

      <main className="page-shell max-w-6xl">
        <Toaster position="top-right" />
        <section className="surface-card-strong px-6 py-6 mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold flex-1 min-w-[220px]">Commandes</h1>
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
            {printerConfigured ? (
              <span className="text-sm font-medium text-emerald-700">
                Imprimante réseau active (TCP auto)
              </span>
            ) : (
              <label className="flex items-center gap-2 text-sm font-medium surface-muted-text">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                />
                Auto-print navigateur
              </label>
            )}
            <span className="surface-muted-text text-sm">Dernier fetch&nbsp;: {lastFetch.current}</span>
            <a href="/serveur" className="btn-soft">
              📋 Mode serveur
            </a>
            <button
              onClick={async () => {
                await fetch("/api/kitchen/logout", { method: "POST" });
                window.location.href = "/kitchen/login";
              }}
              className="btn-ghost"
            >
              Se déconnecter
            </button>
          </div>
        </section>

        {orders.length === 0 ? (
          <p className="surface-muted-text">Aucune commande pour le moment.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {orders.map((o) => {
              return (
                <div key={o.id} className="relative">
                  <div className={`surface-card px-6 py-6 space-y-4 ${isTakeaway(o) ? "ring-2 ring-[var(--color-accent)]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        {isTakeaway(o) ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                              À emporter
                            </span>
                            <span className="text-lg font-semibold tracking-wide">{o.code ?? "?"}</span>
                          </div>
                        ) : (
                          <div className="text-lg font-semibold tracking-wide">Table {o.tableId}</div>
                        )}
                        <div className="text-xs surface-muted-text uppercase tracking-[0.28em]">
                          Total {Math.round(o.total / 100)} DZD
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
                        {Math.round((it.price ?? 0) / 100)} DZD
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
                      handlePrint(o, "kitchen");
                    }}
                    className="btn-ghost"
                    disabled={printingOrderId === o.id}
                    title="Imprimer le ticket cuisine (sans prix)"
                  >
                    {printingOrderId === o.id ? "Envoi…" : "🍜 Ticket cuisine"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePrint(o, "customer");
                    }}
                    className="btn-ghost"
                    disabled={printingOrderId === o.id}
                    title="Imprimer le ticket client (reçu détaillé)"
                  >
                    {printingOrderId === o.id ? "Envoi…" : "🧾 Ticket client"}
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
                  {o.status !== "SERVED" && o.status !== "CANCELED" && (
                    <button
                      onClick={() => setCancelTarget(o)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                      title="Annuler cette commande (erreur, client parti…)"
                    >
                      ✕ Annuler
                    </button>
                  )}
                </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cancelTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !canceling && setCancelTarget(null)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden">
              <div className="h-1 bg-red-500" />
              <div className="px-6 py-6 space-y-3">
                <h2 className="text-base font-semibold text-gray-900">
                  Annuler la commande&nbsp;?
                </h2>
                <p className="text-sm text-gray-600">
                  {isTakeaway(cancelTarget) ? (
                    <>
                      Commande à emporter <span className="font-semibold text-gray-900">{cancelTarget.code}</span> — le
                      code personnage sera libéré pour une prochaine commande.
                    </>
                  ) : (
                    <>
                      Commande de la <span className="font-semibold text-gray-900">table {cancelTarget.tableId}</span>.
                    </>
                  )}{" "}
                  Elle ne comptera plus dans le chiffre d&apos;affaires.
                </p>
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Cette action est <strong>irréversible</strong>.
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={canceling}
                  className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={confirmCancelOrder}
                  disabled={canceling}
                  className="px-4 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 active:bg-red-800 transition disabled:opacity-60"
                >
                  {canceling ? "Annulation…" : "Oui, annuler la commande"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

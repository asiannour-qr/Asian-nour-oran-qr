"use client";

import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

type PrinterConfig = {
  ip: string;
  port: number;
  updatedAt: string;
};

type PrinterRole = "kitchen" | "customer";

const DEFAULT_PORT = 9100;

function PrinterSection({
  role,
  title,
  description,
  config,
  loading,
  onSaved,
}: {
  role: PrinterRole;
  title: string;
  description: string;
  config: PrinterConfig | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setIp(config.ip);
      setPort(String(config.port));
    } else if (!loading) {
      setIp("");
      setPort(String(DEFAULT_PORT));
    }
  }, [config, loading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/printers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ip: ip.trim(), port: Number(port) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sauvegarde échouée");
      toast.success(`${title} enregistrée`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/printers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Test échoué");
      toast.success(data?.message || "Ticket de test envoyé");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="surface-card-strong px-6 py-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm surface-muted-text">{description}</p>
      </div>

      {loading ? (
        <p className="surface-muted-text text-sm">Chargement…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Adresse IP</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="192.168.1.50"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              className="w-full"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Port TCP</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full"
              required
            />
            <p className="text-xs surface-muted-text">Défaut ESC/POS : 9100</p>
          </div>
          {config?.updatedAt && (
            <p className="text-xs surface-muted-text">
              Dernière mise à jour :{" "}
              {new Date(config.updatedAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Africa/Algiers",
              })}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !ip.trim()}
              className="btn-ghost"
            >
              {testing ? "Envoi…" : "Tester"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function AdminPrintersPage() {
  const [loading, setLoading] = useState(true);
  const [kitchen, setKitchen] = useState<PrinterConfig | null>(null);
  const [customer, setCustomer] = useState<PrinterConfig | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/printers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setKitchen((data.kitchen as PrinterConfig | null) ?? null);
      setCustomer((data.customer as PrinterConfig | null) ?? null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <main className="page-shell space-y-8">
      <Toaster position="top-right" />

      <header className="section-heading">
        <span className="chip">Administration</span>
        <h1 className="section-heading__title">Imprimantes réseau</h1>
        <p className="section-heading__subtitle">
          Deux imprimantes Xprinter (ESC/POS, port 9100) : une en cuisine pour les tickets
          de préparation, une en caisse pour les tickets clients.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <PrinterSection
          role="kitchen"
          title="🍜 Imprimante cuisine"
          description="Tickets de préparation (sans prix), impression auto des nouvelles commandes."
          config={kitchen}
          loading={loading}
          onSaved={loadConfig}
        />
        <PrinterSection
          role="customer"
          title="🧾 Imprimante caisse"
          description="Tickets clients (reçu avec prix). Imprimés depuis le mode serveur / caisse."
          config={customer}
          loading={loading}
          onSaved={loadConfig}
        />
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

type PrinterConfig = {
  ip: string;
  port: number;
  updatedAt: string;
};

const DEFAULT_PORT = 9100;

export default function AdminPrintersPage() {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState<string>(String(DEFAULT_PORT));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/printers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const config = data?.config as PrinterConfig | null;
      if (config) {
        setIp(config.ip);
        setPort(String(config.port));
        setUpdatedAt(config.updatedAt);
      } else {
        setIp("");
        setPort(String(data?.defaults?.port ?? DEFAULT_PORT));
        setUpdatedAt(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de chargement";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/printers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ip.trim(), port: Number(port) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sauvegarde échouée");

      const config = data.config as PrinterConfig;
      setIp(config.ip);
      setPort(String(config.port));
      setUpdatedAt(config.updatedAt);
      toast.success("Configuration enregistrée");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de sauvegarde";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/printers/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Test échoué");
      toast.success(data?.message || "Ticket de test envoyé");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de test";
      toast.error(message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="page-shell">
      <Toaster position="top-right" />

      <header className="section-heading mb-8">
        <span className="chip">Administration</span>
        <h1 className="section-heading__title">Imprimante réseau</h1>
        <p className="section-heading__subtitle">
          Configurez votre Xprinter XP-260M (ESC/POS, port TCP 9100). Les tickets de cuisine pourront
          être envoyés directement à cette adresse.
        </p>
      </header>

      <section className="surface-card-strong px-6 py-6 space-y-6 max-w-xl">
        {loading ? (
          <p className="surface-muted-text text-sm">Chargement…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="printer-ip" className="text-sm font-medium">
                Adresse IP
              </label>
              <input
                id="printer-ip"
                type="text"
                inputMode="decimal"
                placeholder="192.168.1.100"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="w-full"
                required
              />
              <p className="text-xs surface-muted-text">Format IPv4 (ex. 192.168.1.50)</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="printer-port" className="text-sm font-medium">
                Port TCP
              </label>
              <input
                id="printer-port"
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

            {updatedAt && (
              <p className="text-xs surface-muted-text">
                Dernière mise à jour :{" "}
                {new Date(updatedAt).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Africa/Algiers",
                })}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
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
    </main>
  );
}

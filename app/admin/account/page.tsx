"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

type AccountData = {
  admin: { username: string; email: string | null; source: "db" | "env" };
  kitchen: { username: string; configured: boolean };
};

export default function AdminAccountPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountData | null>(null);

  // Compte admin
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Compte cuisine
  const [kitchenUsername, setKitchenUsername] = useState("");
  const [kitchenPassword, setKitchenPassword] = useState("");
  const [kitchenConfirm, setKitchenConfirm] = useState("");
  const [savingKitchen, setSavingKitchen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/account", { cache: "no-store" });
      const d: AccountData = await res.json();
      setData(d);
      setAdminUsername(d.admin.username ?? "");
      setAdminEmail(d.admin.email ?? "");
      setKitchenUsername(d.kitchen.username ?? "");
    } catch {
      toast.error("Impossible de charger les comptes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setSavingAdmin(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername.trim(),
          email: adminEmail.trim(),
          currentPassword,
          newPassword: newPassword || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Échec de l'enregistrement");
      toast.success("Compte administrateur mis à jour");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function saveKitchen(e: React.FormEvent) {
    e.preventDefault();
    if (kitchenPassword && kitchenPassword !== kitchenConfirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!data?.kitchen.configured && !kitchenPassword) {
      toast.error("Définissez un mot de passe pour créer le compte cuisine.");
      return;
    }
    setSavingKitchen(true);
    try {
      const res = await fetch("/api/admin/kitchen-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: kitchenUsername.trim(),
          password: kitchenPassword || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Échec de l'enregistrement");
      toast.success("Compte cuisine mis à jour");
      setKitchenPassword("");
      setKitchenConfirm("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setSavingKitchen(false);
    }
  }

  const field =
    "w-full rounded-xl border border-[rgba(120,110,98,0.22)] bg-white/90 px-4 py-2.5 outline-none transition focus:border-[rgba(190,127,57,0.55)] focus:ring-2 focus:ring-[rgba(190,127,57,0.18)]";
  const labelCls = "text-sm font-medium text-[var(--color-heading,#2f2922)]";

  if (loading) {
    return <div className="surface-muted-text">Chargement…</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <Toaster position="top-right" />

      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Comptes &amp; accès</h1>
        <p className="surface-muted-text text-sm">
          Gérez l&apos;identifiant et le mot de passe de l&apos;administrateur et du personnel de cuisine.
        </p>
      </header>

      {/* Compte administrateur */}
      <form onSubmit={saveAdmin} className="surface-card px-6 py-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Compte administrateur</h2>
          <p className="surface-muted-text text-sm">
            {data?.admin.source === "env"
              ? "Compte actuellement basé sur la configuration serveur. Définissez un mot de passe ci-dessous pour le gérer depuis l'admin."
              : "Modifiez votre identifiant, e-mail et mot de passe."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelCls}>Identifiant</span>
            <input className={field} value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoCapitalize="none" required />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>E-mail entreprise</span>
            <input className={field} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="contact@asiannour.dz" />
          </label>
        </div>

        <div className="h-px bg-[rgba(120,110,98,0.16)]" />

        <label className="space-y-1 block">
          <span className={labelCls}>Mot de passe actuel</span>
          <input className={field} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelCls}>Nouveau mot de passe</span>
            <input className={field} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Laisser vide pour ne pas changer" />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Confirmer</span>
            <input className={field} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={savingAdmin}>
            {savingAdmin ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>

      {/* Compte cuisine */}
      <form onSubmit={saveKitchen} className="surface-card px-6 py-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Compte cuisine</h2>
          <p className="surface-muted-text text-sm">
            {data?.kitchen.configured
              ? "Identifiant et mot de passe utilisés par le personnel pour accéder à l'écran cuisine."
              : "Aucun compte cuisine configuré. Définissez un identifiant et un mot de passe pour permettre la connexion."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelCls}>Identifiant</span>
            <input className={field} value={kitchenUsername} onChange={(e) => setKitchenUsername(e.target.value)} autoCapitalize="none" required />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelCls}>{data?.kitchen.configured ? "Nouveau mot de passe" : "Mot de passe"}</span>
            <input className={field} type="password" value={kitchenPassword} onChange={(e) => setKitchenPassword(e.target.value)} autoComplete="new-password" placeholder={data?.kitchen.configured ? "Laisser vide pour ne pas changer" : ""} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Confirmer</span>
            <input className={field} type="password" value={kitchenConfirm} onChange={(e) => setKitchenConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={savingKitchen}>
            {savingKitchen ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

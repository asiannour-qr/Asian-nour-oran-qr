"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export default function AdminEmporterPage() {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const baseUrl = useMemo(() => getPublicBaseUrl(), []);

  const emporterUrl = baseUrl ? `${baseUrl}/emporter` : "";

  const generate = useCallback(async () => {
    if (!emporterUrl) return;
    setBusy(true);
    try {
      const url = await QRCode.toDataURL(emporterUrl, {
        errorCorrectionLevel: "M",
        // marge ≥ 2 : zone de silence indispensable au scan
        margin: 3,
        scale: 10,
      });
      setDataUrl(url);
    } finally {
      setBusy(false);
    }
  }, [emporterUrl]);

  useEffect(() => {
    void generate();
  }, [generate]);

  return (
    <main className="page-shell space-y-8">
      <header className="surface-card-strong px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div className="space-y-2">
          <span className="chip">QR Façade — À emporter</span>
          <h1 className="text-3xl font-semibold">Commandes à emporter</h1>
          <p className="surface-muted-text text-sm max-w-xl">
            Un seul QR code pour toutes les commandes à emporter. Affichez-le sur la façade
            ou au comptoir. Chaque commande reçoit automatiquement un code personnage manga
            (Goku, Vegeta, Luffy…) pour la différencier en cuisine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={generate} disabled={busy} className="btn-ghost">
            {busy ? "Génération…" : "Régénérer"}
          </button>
          <button onClick={() => window.print()} className="btn-primary" disabled={!dataUrl}>
            Imprimer
          </button>
        </div>
      </header>

      {!dataUrl ? (
        <p className="surface-muted-text">Génération du QR…</p>
      ) : (
        <section className="flex justify-center">
          <article className="surface-card px-8 py-10 flex flex-col items-center gap-5 print:break-inside-avoid max-w-sm w-full">
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold">Asian Nour</div>
              <div className="text-sm surface-muted-text tracking-[0.3em] uppercase">
                Commandez à emporter
              </div>
            </div>
            <Image
              src={dataUrl}
              alt="QR à emporter"
              className="w-64 h-64"
              width={320}
              height={320}
              unoptimized
            />
            <div className="text-center space-y-2">
              <div className="text-base font-medium">
                Scannez · Commandez · Récupérez
              </div>
              <p className="text-sm surface-muted-text">
                Présentez votre code personnage à l&apos;hôte de caisse pour valider
                votre ticket après paiement.
              </p>
              <div className="text-xs surface-muted-text mt-1 font-mono">
                {emporterUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

// app/page.tsx
import Image from "next/image";
import { HomeMenuCardSection } from "@/app/components/HomeMenuCardSection";
import { formatDayHoursLabel } from "@/lib/opening-hours";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const JOURS_ORDRE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const JOURS_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

export default async function Home() {
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }

  const name = settings?.restaurantName || "Asian Nour";
  const hours = settings?.openingHours ?? {};
  const hasHours = JOURS_ORDRE.some((j) => hours[j]);

  return (
    <main className="page-shell flex flex-col items-center gap-6">
      <div className="surface-card-strong w-full max-w-2xl px-8 py-10 text-center space-y-5">
        <div className="mx-auto w-fit bg-black rounded-2xl overflow-hidden px-3 py-1">
          <Image
            src="/logo-header.png"
            alt={name}
            width={440}
            height={220}
            priority
            className="h-16 w-auto"
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-wide">
          Bienvenue chez {name}
        </h1>
        <p className="text-base leading-relaxed surface-muted-text">
          Deux parcours&nbsp;: commande à table (scannez le QR sur votre table) ou commande à
          emporter (QR façade / bouton ci-dessous).
        </p>
        {(settings?.address || settings?.phone) && (
          <div className="text-sm surface-muted-text space-y-1">
            {settings?.address && <p>📍 {settings.address}</p>}
            {settings?.phone && <p>📞 {settings.phone}</p>}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <a href="/emporter" className="btn-primary text-center">
            Commander à emporter
          </a>
        </div>
        <p className="text-xs surface-muted-text pt-1">
          Sur place&nbsp;: scannez uniquement le QR collé sur votre table.
          À emporter&nbsp;: bouton ci-dessus ou QR en façade.
        </p>
      </div>

      <HomeMenuCardSection alt={`Carte ${name}`} />

      {hasHours && (
        <div className="surface-card w-full max-w-2xl px-8 py-6 space-y-3">
          <h2 className="text-lg font-semibold text-center">Horaires d&apos;ouverture</h2>
          <ul className="text-sm divide-y divide-black/5">
            {JOURS_ORDRE.map((j) => {
              const h = hours[j];
              if (!h) return null;
              return (
                <li key={j} className="flex items-center justify-between py-1.5">
                  <span className="font-medium">{JOURS_LABELS[j]}</span>
                  <span className="surface-muted-text">
                    {h.ouvert ? formatDayHoursLabel(h) : "Fermé"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}

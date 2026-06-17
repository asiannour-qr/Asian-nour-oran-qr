// app/page.tsx
import Image from "next/image";
import MenuCardGallery from "@/app/components/MenuCardGallery";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type DayHours = { ouvert: boolean; debut: string; fin: string };

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
  const hours = (settings?.openingHours ?? {}) as Record<string, DayHours>;
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
          Scannez le QR code de votre table pour consulter la carte et commander directement
          depuis votre téléphone. À emporter&nbsp;? Scannez le QR code en façade.
        </p>
        {(settings?.address || settings?.phone) && (
          <div className="text-sm surface-muted-text space-y-1">
            {settings?.address && <p>📍 {settings.address}</p>}
            {settings?.phone && <p>📞 {settings.phone}</p>}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <a href="/emporter" className="btn-primary text-center">
            Commander à emporter
          </a>
        </div>
        <p className="text-xs surface-muted-text pt-1">
          Sur place&nbsp;: scannez le QR code de votre table pour commander.
        </p>
      </div>

      <div className="surface-card w-full max-w-2xl px-4 sm:px-8 py-6 space-y-4">
        <h2 className="text-lg font-semibold text-center">Notre carte</h2>
        <p className="text-sm surface-muted-text text-center">
          Consultez la carte complète du restaurant avant de commander.
        </p>
        <MenuCardGallery alt={`Carte ${name}`} />
      </div>

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
                    {h.ouvert ? `${h.debut} – ${h.fin}` : "Fermé"}
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

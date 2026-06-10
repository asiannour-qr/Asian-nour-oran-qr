import MenuCardImage from "@/app/components/MenuCardImage";
import StartOrderButton from "./StartOrderButton";
import { getSettings, resolveMenuCardImageUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function CartePage({ params }: { params: { id: string } }) {
  const tableId = params.id;
  let settings = null;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }

  const menuCardSrc = resolveMenuCardImageUrl(settings);
  const restaurantName = settings?.restaurantName || "Asian Nour";

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)] pb-24">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Notre carte</h1>
            <p className="text-sm surface-muted-text">
              {restaurantName} — Table {tableId}
            </p>
          </div>
          <StartOrderButton
            tableId={tableId}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#7a5640] text-white hover:brightness-110 text-center"
          >
            Commencer la commande
          </StartOrderButton>
        </header>

        <section className="min-h-[calc(100vh-14rem)] flex items-start justify-center px-2 py-4 sm:px-4">
          <div className="w-full max-w-[900px] md:max-w-[1100px] mx-auto">
            <MenuCardImage
              src={menuCardSrc}
              alt={`Carte ${restaurantName}`}
              priority
            />
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-[rgba(245,239,230,0.96)] border-t border-[rgba(190,127,57,0.22)] shadow-[0_-10px_30px_rgba(61,47,33,0.12)] px-4 py-3">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm surface-muted-text">Table #{tableId}</span>
          <StartOrderButton
            tableId={tableId}
            className="w-full sm:w-auto inline-flex justify-center px-5 py-3 rounded-2xl bg-[#7a5640] text-white text-base font-semibold shadow-elevated hover:brightness-110 transition"
          >
            Passer à la commande
          </StartOrderButton>
        </div>
      </div>
    </div>
  );
}

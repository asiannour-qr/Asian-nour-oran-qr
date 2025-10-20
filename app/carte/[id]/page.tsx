import Image from "next/image";
import StartOrderButton from "./StartOrderButton";

type SectionItem = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
};

type Section = {
  id: string;
  name: string;
  items: SectionItem[];
};

function normalizeItems(rawItems: unknown): SectionItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item: any) => {
      if (!item || typeof item !== "object") return null;
      const id = item.id ?? item._id ?? item.slug ?? item.name ?? `${Math.random()}`;
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : String(id);
      const priceCents = item.priceCents ?? item.price_cents;
      let price = 0;
      if (priceCents != null && Number.isFinite(Number(priceCents))) {
        price = Number(priceCents) / 100;
      } else if (item.price != null && Number.isFinite(Number(item.price))) {
        price = Number(item.price);
      }
      const description = typeof item.description === "string" ? item.description : undefined;
      return {
        id: String(id),
        name,
        price,
        description,
      } as SectionItem;
    })
    .filter((item): item is SectionItem => Boolean(item));
}

function toSection(section: any, index: number): Section {
  const id = section?.id ?? section?.slug ?? section?.name ?? `section-${index}`;
  const name = typeof section?.name === "string" && section.name.trim() ? section.name.trim() : `Section ${index + 1}`;
  const rawItems = section?.items ?? section?.products ?? section?.entries ?? [];
  return {
    id: String(id),
    name,
    items: normalizeItems(rawItems),
  };
}

function normalizeSections(data: any): Section[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.map((section, index) => toSection(section, index));
  }

  if (Array.isArray(data?.sections)) {
    return data.sections.map((section: any, index: number) => toSection(section, index));
  }

  if (Array.isArray(data?.groups)) {
    return data.groups.map((group: any, index: number) => toSection(group, index));
  }

  if (Array.isArray(data?.categories)) {
    return data.categories.map((category: any, index: number) => toSection(category, index));
  }

  return [];
}

async function fetchMenu(tableId: string): Promise<Section[]> {
  const params = new URLSearchParams({ table: tableId });
  const endpoints: string[] = [];
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    endpoints.push(`${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/api/menu?${params.toString()}`);
  }
  endpoints.push(`/api/menu?${params.toString()}`);

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const sections = normalizeSections(data);
      if (process.env.NODE_ENV !== "production" && sections.length === 0) {
        console.warn(`[carte] Aucune section normalisée pour la table ${tableId}`);
      }
      return sections;
    } catch (error) {
      lastError = error;
    }
  }

  if (process.env.NODE_ENV !== "production" && lastError) {
    console.warn("[carte] fetch menu error", lastError);
  }

  return [];
}

export default async function CartePage({ params }: { params: { id: string } }) {
  const tableId = params.id;
  const sections = await fetchMenu(tableId);

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)] pb-24">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Carte — Table {tableId}</h1>
          <StartOrderButton tableId={tableId} className="px-4 py-2 rounded-lg bg-[#7a5640] text-white hover:brightness-110">
            Commencer la commande
          </StartOrderButton>
        </header>

        {sections.length === 0 ? (
          <div className="space-y-6">
            <div className="surface-muted-text text-center py-10">
              Cette carte est vide pour le moment.
            </div>
            <div className="grid gap-4">
              <Image
                src="/carte/asian-nour/page-1.jpg"
                alt="Carte page 1"
                width={1200}
                height={1700}
                className="w-full h-auto rounded-xl shadow"
                priority
              />
              <Image
                src="/carte/asian-nour/page-2.jpg"
                alt="Carte page 2"
                width={1200}
                height={1700}
                className="w-full h-auto rounded-xl shadow"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {sections.map((sec) => (
              <section key={sec.id} className="rounded-xl bg-white/80 border border-black/10 p-4">
                <h2 className="text-lg font-semibold mb-3">{sec.name}</h2>
                {sec.items.length === 0 ? (
                  <div className="text-sm text-black/60">Aucun plat disponible dans cette section.</div>
                ) : (
                  <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sec.items.map((item) => (
                      <li key={item.id} className="rounded-lg border border-black/10 p-3 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">{item.name}</div>
                          <div className="shrink-0 font-semibold">
                            {Number.isFinite(item.price) ? `${item.price.toFixed(2)} €` : ""}
                          </div>
                        </div>
                        {item.description ? (
                          <p className="text-sm text-black/60 mt-1">{item.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

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

import Link from "next/link";

type MenuSection = {
  id: string;
  name: string;
  items: { id: string; name: string; price?: number | null; spicyLevel?: number | null; description?: string | null }[];
};

async function getMenu(): Promise<MenuSection[]> {
  // Essaye d'abord l'URL publique si définie (prod), sinon retombe sur le relatif (dev)
  const pub = process.env.NEXT_PUBLIC_BASE_URL;
  try {
    if (pub) {
      const res = await fetch(`${pub}/api/menu`, { cache: "no-store" });
      if (res.ok) return res.json();
    }
  } catch {}
  const res2 = await fetch("/api/menu", { cache: "no-store" });
  if (!res2.ok) throw new Error("API menu indisponible");
  return res2.json();
}

export default async function CartePage({ params }: { params: { id: string } }) {
  const tableId = params.id;
  const sections = await getMenu();

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Carte — Table {tableId}</h1>
          <Link
            href={`/table/${tableId}`}
            className="px-4 py-2 rounded-lg bg-[#7a5640] text-white hover:brightness-110"
          >
            Commencer la commande
          </Link>
        </header>

        <div className="grid gap-6">
          {sections.map((sec) => (
            <section key={sec.id} className="rounded-xl bg-white/80 border border-black/10 p-4">
              <h2 className="text-lg font-semibold mb-3">{sec.name}</h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sec.items.map(item => (
                  <li key={item.id} className="rounded-lg border border-black/10 p-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="shrink-0 font-semibold">
                        {item.price != null ? `${item.price.toFixed(2)} €` : ""}
                      </div>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-black/60 mt-1">{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href={`/table/${tableId}`}
            className="px-5 py-3 rounded-xl bg-[#7a5640] text-white hover:brightness-110 text-base"
          >
            Commander à la table {tableId}
          </Link>
        </div>
      </div>
    </div>
  );
}

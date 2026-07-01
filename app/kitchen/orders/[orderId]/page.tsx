import { prisma } from "../../../../lib/prisma";
import { resolveOrderGuestNames } from "@/lib/guest-names-db";
import { guestNameFromMap } from "@/lib/guest-name-utils";
import { formatMoney } from "@/lib/currency";

export default async function OrderPage({
  params,
}: {
  params: { orderId: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true },
  });
  const guestNames = order ? resolveOrderGuestNames(order) : null;

  if (!order) {
    return <div className="p-6">Commande introuvable.</div>;
  }

  return (
    <main className="page-shell max-w-3xl space-y-6">
      <header className="surface-card-strong px-6 py-6 rounded-3xl space-y-1">
        <span className="chip">Ticket cuisine</span>
        <h1 className="text-3xl font-semibold">Commande #{order.id}</h1>
        <p className="surface-muted-text text-sm">
          Table {order.tableId} — Total {formatMoney(order.total)}
        </p>
      </header>

      <section className="surface-card px-6 py-6 space-y-4">
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-4 border-b border-[rgba(120,110,98,0.14)] pb-2 last:border-0">
              <div>
                <span className="font-medium">{it.qty} × {it.name}</span>{" "}
                {it.personId ? (
                  <em className="surface-muted-text">
                    ({guestNameFromMap(guestNames ?? undefined, it.personId)})
                  </em>
                ) : null}
                {Array.isArray(it.supplements) && it.supplements.length ? (
                  <ul className="text-xs text-[var(--color-accent-strong)] mt-0.5">
                    {(it.supplements as { label: string; priceCents: number }[]).map((s, i) => (
                      <li key={i}>+ {s.label} ({formatMoney(s.priceCents)})</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <span className="tabular-nums text-sm surface-muted-text">
                {formatMoney(it.price ?? 0)}
              </span>
            </li>
          ))}
        </ul>

        {order.comment ? (
          <p className="surface-panel px-4 py-3 rounded-2xl border border-[rgba(120,110,98,0.16)] text-sm">
            <span className="font-semibold">Commentaire :</span> {order.comment}
          </p>
        ) : null}

        <div className="flex justify-between items-center pt-3 border-t border-[rgba(120,110,98,0.18)]">
          <span className="font-medium">Total</span>
          <span className="text-xl font-semibold">{formatMoney(order.total)}</span>
        </div>
      </section>
    </main>
  );
}

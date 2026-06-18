"use client";

type HistoryEntry = {
    dateLabel: string;
    total: number;
    dineIn?: number;
    takeaway?: number;
    count?: number;
};

type RevenueHistoryTableProps = {
    history: HistoryEntry[];
    formatMoney: (cents: number) => string;
};

export default function RevenueHistoryTable({ history, formatMoney }: RevenueHistoryTableProps) {
    if (!history.length) {
        return <div className="surface-muted-text text-sm">Aucune commande sur la période.</div>;
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 bg-[rgba(245,239,230,0.65)] text-xs uppercase tracking-[0.25em] text-[var(--color-heading)] px-4 py-3">
                <span>Date</span>
                <span className="text-right">Sur place</span>
                <span className="text-right">Emporter</span>
                <span className="text-right">Total</span>
            </div>
            <ul className="divide-y divide-black/5">
                {history.map((entry) => (
                    <li key={entry.dateLabel} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm items-center">
                        <span className="font-medium">
                            {entry.dateLabel}
                            {entry.count != null && (
                                <span className="ml-2 text-xs surface-muted-text">({entry.count} cmd)</span>
                            )}
                        </span>
                        <span className="text-right surface-muted-text">{formatMoney(entry.dineIn ?? 0)}</span>
                        <span className="text-right surface-muted-text">{formatMoney(entry.takeaway ?? 0)}</span>
                        <span className="text-right font-semibold">{formatMoney(entry.total)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

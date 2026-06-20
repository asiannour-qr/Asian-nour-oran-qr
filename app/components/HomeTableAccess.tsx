"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { clampTableCount } from "@/lib/table-count";

type HomeTableAccessProps = {
  tableCount?: number;
};

export function HomeTableAccess({ tableCount = 25 }: HomeTableAccessProps) {
  const maxTable = clampTableCount(tableCount);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1 || n > maxTable) {
      setError(`Indiquez un numéro entre 1 et ${maxTable}.`);
      return;
    }
    setError(null);
    router.push(`/table/${n}`);
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-2 text-left">
      <p className="text-sm font-medium text-[var(--color-heading)]">Sur place — accéder à votre table</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="number"
          min={1}
          max={maxTable}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={`N° table (1–${maxTable})`}
          className="flex-1 min-w-0"
          aria-label="Numéro de table"
        />
        <button type="submit" className="btn-soft shrink-0 px-4">
          Commander
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs surface-muted-text">
        En salle, scannez de préférence le QR collé sur votre table.
      </p>
    </div>
  );
}

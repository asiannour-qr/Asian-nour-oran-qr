"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback } from "react";

type StartOrderButtonProps = {
  tableId: string;
  className?: string;
  children: ReactNode;
};

export default function StartOrderButton({ tableId, className, children }: StartOrderButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/table/${tableId}?order=1`);
  }, [router, tableId]);

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

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
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("skipMenuLanding", "1");
    }
    router.push(`/table/${tableId}`);
  }, [router, tableId]);

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_ON = ["/admin", "/kitchen"];

export default function SiteHeader() {
  const pathname = usePathname() ?? "";

  const hidden = HIDDEN_ON.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
  );

  if (hidden) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(120,110,98,0.14)] bg-[rgba(242,237,230,0.82)] backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center">
        <Link
          href="/"
          className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(190,127,57,0.5)]"
          aria-label="Asian Nour — Accueil"
        >
          <div className="bg-black rounded-xl overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.28)] hover:shadow-[0_5px_20px_rgba(0,0,0,0.38)] transition-shadow duration-200 px-1">
            <Image
              src="/logo-header.png"
              alt="Asian Nour"
              width={440}
              height={220}
              priority
              className="h-11 w-auto"
            />
          </div>
        </Link>
      </div>
    </header>
  );
}

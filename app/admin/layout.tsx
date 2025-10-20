"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const tabs = [
  { href: "/admin/qr", label: "QR / Badges" },
  { href: "/admin/menu", label: "Carte (Plats)" },
  { href: "/admin/menus", label: "Menus composés" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname?.startsWith("/admin/login")) {
    return <>{children}</>;
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="font-semibold tracking-wide">Admin — Asian Nour</div>
          <nav className="flex gap-2 items-center">
            {tabs.map((t) => {
              const active = pathname ? pathname === t.href || pathname.startsWith(`${t.href}/`) : false;
              const base =
                "px-3 py-1.5 rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(190,127,57,0.45)]";
              const activeClasses = active
                ? "border-[#7a5640] bg-[#7a5640] text-white shadow-sm"
                : "border-black/10 text-[var(--fg,#2f2922)] hover:bg-black/5";
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`${base} ${activeClasses}`}
                >
                  {t.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-1.5 rounded-lg border border-black/10 text-[#7a5640] hover:bg-black/5 transition disabled:opacity-50"
            >
              {loggingOut ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

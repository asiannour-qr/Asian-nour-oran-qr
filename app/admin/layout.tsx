import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { href: "/admin/qr", label: "QR / Badges" },
    { href: "/admin/menu", label: "Carte / Menus" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg,#f5efe6)] text-[var(--fg,#2f2922)]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-wide">Admin — Asian Nour</div>
          <nav className="flex gap-2">
            {tabs.map(t => (
              <Link
                key={t.href}
                href={t.href}
                className="px-3 py-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

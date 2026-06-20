// app/admin/qrs/page.tsx
"use client";

import { TableQrPanel } from "@/app/components/TableQrPanel";

export default function AdminQRCodesPage() {
  return (
    <main className="page-shell space-y-8">
      <TableQrPanel
        title="Tables prêtes à l'impression"
        subtitle="Générez vos QR codes en fonction du nombre de tables, puis imprimez-les pour les disposer sur vos supports A4."
        showBadgesLink
      />
    </main>
  );
}

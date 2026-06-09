import type { Metadata, Viewport } from "next";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "Admin — Asian Nour",
  manifest: "/manifests/admin.webmanifest",
  icons: {
    icon: [
      { url: "/icons/patch-admin-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/patch-admin-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/patch-admin-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Admin AN",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

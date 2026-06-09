import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Serveur — Asian Nour",
  manifest: "/manifests/serveur.webmanifest",
  icons: {
    icon: [
      { url: "/icons/patch-serveur-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/patch-serveur-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/patch-serveur-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Serveur AN",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function ServeurLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

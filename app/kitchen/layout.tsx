import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cuisine — Asian Nour",
  manifest: "/manifests/kitchen.webmanifest",
  icons: {
    icon: [
      { url: "/icons/patch-kitchen-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/patch-kitchen-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/patch-kitchen-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Cuisine AN",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

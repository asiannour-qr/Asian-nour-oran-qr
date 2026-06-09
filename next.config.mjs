/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      // Anciennes pages héritées
      { source: "/menu", destination: "/", permanent: false },
      { source: "/t/:tableId", destination: "/table/:tableId", permanent: false },
    ];
  },
};
export default nextConfig;

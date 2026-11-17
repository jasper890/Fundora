import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate e2e dist from the interactive `next dev` lock/cache when needed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:* http://localhost:* https://soroban-testnet.stellar.org https://*.supabase.co; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

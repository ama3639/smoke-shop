import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  images: { formats: ["image/avif", "image/webp"] },
  async rewrites() {
    return [
      { source: "/admin/:path*", destination: `${backend}/admin/:path*/` },
      { source: "/static/:path*", destination: `${backend}/static/:path*` },
      { source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*/` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source:
          "/:section(account|login|register|cart|checkout|orders|search|wishlist|manage|supplier)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default config;

import type { NextConfig } from "next";

/**
 * Baseline security headers. Deliberately conservative so nothing breaks: no CSP yet
 * (needs an inline-style/script + external-image-source audit first — tracked as a
 * follow-up), and framing is denied only on /admin/* so a restaurant can still embed
 * its own public menu if it wants to.
 */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      // Admin surfaces must never be framed (clickjacking) and must not be indexed.
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;

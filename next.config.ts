import type { NextConfig } from "next";

// Baseline hardening. These are the non-breaking headers (no script-src CSP,
// which needs per-request nonce wiring in middleware — the P1 gate before BYOK).
// `frame-ancestors 'none'` is the meaningful one for a credential-bearing app:
// it blocks clickjacking of the sign-in / live-session UI. `microphone=(self)`
// keeps the realtime mic grant first-party only.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker multi-stage builds
  transpilePackages: ["@sevenlabs/panel-core", "@sevenlabs/shared-types"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // /mock -> /interview rename (2026-07). Redirects keep old bookmarks working;
  // the API rewrite keeps stale client bundles (sessions in flight across a
  // deploy) working transparently. Drop the rewrite once old clients age out.
  async redirects() {
    return [
      { source: "/mock", destination: "/interview", permanent: true },
      { source: "/mock/:id", destination: "/interview/:id", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/mock/:path*", destination: "/api/interview/:path*" },
    ];
  },
};

export default nextConfig;

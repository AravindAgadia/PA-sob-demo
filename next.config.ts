import type { NextConfig } from "next";

// Applies to every response, dev and production alike — none of these
// interfere with Turbopack's dev tooling (HMR, etc).
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Every request this app makes to OpenAI/NPPES happens server-side (inside
// Server Actions), so the browser never needs to reach either directly —
// 'self' covers everything the client legitimately loads. Kept out of dev
// mode since Turbopack's HMR client can rely on patterns ('unsafe-eval',
// websocket connections) this CSP doesn't need to accommodate in
// production. 'unsafe-inline' stays in for now because Tailwind/base-ui
// inject inline styles and Next.js inlines its hydration data script;
// tightening further would mean wiring per-request nonces through
// middleware, which is more machinery than this app needs yet.
const productionCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const headers = [...baseSecurityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: productionCsp });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;

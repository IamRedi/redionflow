/**
 * BDF-P8-007 baseline security headers.
 *
 * A stricter Content-Security-Policy would be ideal but requires
 * mapping every inline style and third-party embed first; the four
 * headers below are the safe, no-configuration-needed subset that
 * every modern SaaS ships:
 *
 *   - HSTS ensures the browser upgrades every future request to
 *     HTTPS for a year, blocking downgrade attacks on shared Wi-Fi.
 *   - X-Frame-Options=DENY protects against clickjacking overlays
 *     from third-party sites (Workzone should never be embedded).
 *   - X-Content-Type-Options=nosniff stops browsers from second-
 *     guessing a `Content-Type` and executing an uploaded file as
 *     JavaScript.
 *   - Referrer-Policy=strict-origin-when-cross-origin keeps the
 *     tenant company slug out of external referer headers.
 *   - Permissions-Policy pares down the default browser feature
 *     surface (camera stays enabled for barcode scanning, GPS for
 *     Workzone maps).
 */

/**
 * BDF-P8-007 Content-Security-Policy — report-only rollout.
 *
 * Sending CSP as `Report-Only` lets the browser tell us what would
 * have been blocked without actually blocking legitimate features
 * (Tailwind inline styles, Leaflet tiles, Firebase messaging worker,
 * Supabase Storage image URLs). Violations POST to /api/csp-report
 * which forwards them into the structured logger under
 * `csp.report_only.violation` so an operator can widen the policy
 * before we flip it to enforcement.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-report",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    localPatterns: [
      {
        pathname: "/branding/baumdienstflow-hero.png",
        search: "?v=20260427-2",
      },
      {
        pathname: "/landingpagephoto/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;

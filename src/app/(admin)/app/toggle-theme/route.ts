import { cookies } from "next/headers";
import { headers } from "next/headers";

const FALLBACK_LOCATION = "/app/dashboard";

/**
 * Only allow same-origin redirects. Reading the raw Referer would
 * open a classic open-redirect vulnerability: an attacker could
 * point a form at /app/toggle-theme with Referer: https://evil.com
 * and land the logged-in user on evil.com.
 */
function safeRedirect(rawReferer: string | null, host: string | null): string {
  if (!rawReferer) return FALLBACK_LOCATION;
  try {
    const url = new URL(rawReferer);
    if (!host || url.host !== host) return FALLBACK_LOCATION;
    // Preserve the path + query so the theme toggle returns the user to
    // the same view they were on.
    return `${url.pathname}${url.search}${url.hash}` || FALLBACK_LOCATION;
  } catch {
    return FALLBACK_LOCATION;
  }
}

export async function POST() {
  const jar = await cookies();
  const hdrs = await headers();
  const current = jar.get("bk_theme")?.value;
  const next = current === "dark" ? "light" : "dark";
  const redirectTo = safeRedirect(hdrs.get("referer"), hdrs.get("host"));

  jar.set("bk_theme", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return new Response(null, {
    status: 303,
    headers: { Location: redirectTo },
  });
}


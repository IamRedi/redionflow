import { createHash, createHmac, randomInt } from "node:crypto";

/**
 * RediOnFlow and KiDraht (company rules, manuals, briefings) through KiDraht's API.
 *
 * - KIDRAHT_URL           KiDraht origin, e.g. https://kidraht-production-bc4a.up.railway.app
 * - KIDRAHT_SETUP_TOKEN   operator token: lets RediOnFlow create the company's KiDraht workspace on first open
 * - KIDRAHT_EMBED=1       show KiDraht inside the app (KiDraht must list this origin in KIDRAHT_FRAME_ANCESTORS);
 *                         otherwise the KiDraht button opens KiDraht itself, already signed in.
 *
 * People never type a second PIN: the server signs a short link with the company's
 * KiDraht API key (HMAC-SHA256 with the key's sha256 hex, the same check KiDraht does).
 */

export type KidrahtRole = "owner" | "editor" | "worker";
export type KidrahtLang = "de" | "sq" | "en";

export interface KidrahtLogin {
  ws: string;
  ext: string;
  name: string;
  role: KidrahtRole;
  lang: KidrahtLang;
  exp: number;
}

type Env = Record<string, string | undefined>;

export function kidrahtBase(env: Env = process.env): string | null {
  const raw = (env.KIDRAHT_URL ?? "").trim();
  if (!raw || raw === "off") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const kidrahtEmbedded = (env: Env = process.env) => env.KIDRAHT_EMBED === "1";

/** Short-lived sign-in link for one person (valid 2 minutes). */
export function kidrahtLoginUrl(base: string, apiKey: string, login: Omit<KidrahtLogin, "exp">, now = Date.now()): string {
  const key = createHash("sha256").update(apiKey).digest("hex");
  const payload = Buffer.from(JSON.stringify({ ...login, exp: now + 120_000 })).toString("base64url");
  const token = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
  const q = new URLSearchParams({ ws: login.ws, t: token });
  return `${base}/v1/auth/platform?${q.toString()}`;
}

export function kidrahtLang(value: string | null | undefined): KidrahtLang {
  const v = (value ?? "").toLowerCase();
  return v === "sq" || v === "en" ? v : "de";
}

/** Admins own the company rules; engineers and the office may write them; everyone else reads and asks. */
export function kidrahtRole(person: { isAdmin: boolean; crewRole?: string | null }): KidrahtRole {
  if (person.isAdmin) return "owner";
  return person.crewRole === "FIELD_ENGINEER" || person.crewRole === "FACTORY_ENGINEER" || person.crewRole === "OFFICE" ? "editor" : "worker";
}

/** Which KiDraht base pack the company gets. */
export function kidrahtTrade(company: { mode: string; country: string }): { trade?: string; country: "DE" | "AL" } {
  const country = company.country === "AL" ? "AL" : "DE";
  if (company.mode === "baumdienst") return { trade: "baumdienst", country };
  if (company.mode === "bau" && country === "AL") return { trade: "metal", country };
  return { country };
}

/** Create the company's KiDraht workspace (operator token). Returns null if KiDraht is not reachable. */
export async function createKidrahtWorkspace(
  base: string,
  setupToken: string,
  company: { displayName: string; mode: string; country: string },
  ownerName: string,
  lang: KidrahtLang,
  fetchImpl: typeof fetch = fetch,
): Promise<{ workspaceId: string; apiKey: string } | null> {
  const { trade, country } = kidrahtTrade(company);
  const res = await fetchImpl(`${base}/v1/setup/company`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-setup-token": setupToken },
    // The owner PIN is never used: people sign in through RediOnFlow.
    body: JSON.stringify({ name: company.displayName, ownerName, ownerPin: String(randomInt(10_000_000, 99_999_999)), lang, trade, country, apiKey: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const out = (await res.json()) as { workspaceId?: unknown; apiKey?: unknown };
  return typeof out.workspaceId === "string" && typeof out.apiKey === "string" ? { workspaceId: out.workspaceId, apiKey: out.apiKey } : null;
}

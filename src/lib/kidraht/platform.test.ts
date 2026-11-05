import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createKidrahtWorkspace, kidrahtBase, kidrahtLang, kidrahtLoginUrl, kidrahtRole, kidrahtTrade } from "./platform";

describe("KiDraht platform link", () => {
  it("takes only an https origin from KIDRAHT_URL", () => {
    expect(kidrahtBase({})).toBeNull();
    expect(kidrahtBase({ KIDRAHT_URL: "off" })).toBeNull();
    expect(kidrahtBase({ KIDRAHT_URL: "http://evil.test" })).toBeNull();
    expect(kidrahtBase({ KIDRAHT_URL: "https://k.test/f/firma/" })).toBe("https://k.test");
  });

  it("signs the link the way KiDraht checks it (HMAC with the key's sha256 hex)", () => {
    const now = Date.parse("2026-11-02T23:00:00Z");
    const url = new URL(kidrahtLoginUrl("https://k.test", "kd_secret", { ws: "al-steel-1", ext: "w-1", name: "Elton Muster", role: "worker", lang: "sq" }, now));
    expect(url.pathname).toBe("/v1/auth/platform");
    expect(url.searchParams.get("ws")).toBe("al-steel-1");
    const [payload, mac] = url.searchParams.get("t")!.split(".");
    const key = createHash("sha256").update("kd_secret").digest("hex");
    expect(mac).toBe(createHmac("sha256", key).update(payload!).digest("base64url"));
    const body = JSON.parse(Buffer.from(payload!, "base64url").toString());
    expect(body).toMatchObject({ ws: "al-steel-1", ext: "w-1", role: "worker", lang: "sq", exp: now + 120_000 });
    expect(url.toString()).not.toContain("kd_secret");
  });

  it("maps roles, languages and the base pack", () => {
    expect(kidrahtRole({ isAdmin: true })).toBe("owner");
    expect(kidrahtRole({ isAdmin: false, crewRole: "FACTORY_ENGINEER" })).toBe("editor");
    expect(kidrahtRole({ isAdmin: false, crewRole: "FIELD_WORKER" })).toBe("worker");
    expect(kidrahtLang("SQ")).toBe("sq");
    expect(kidrahtLang("PL")).toBe("de");
    expect(kidrahtTrade({ mode: "bau", country: "AL" })).toEqual({ trade: "metal", country: "AL" });
    expect(kidrahtTrade({ mode: "baumdienst", country: "DE" })).toEqual({ trade: "baumdienst", country: "DE" });
    expect(kidrahtTrade({ mode: "bau", country: "DE" })).toEqual({ country: "DE" });
  });

  it("creates the company workspace with the setup token and asks for the API key", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify({ workspaceId: "al-steel-construction-ab12", apiKey: "kd_x" }), { status: 201 });
    }) as unknown as typeof fetch;
    const out = await createKidrahtWorkspace("https://k.test", "tok", { displayName: "AL-Steel Construction", mode: "bau", country: "AL" }, "Megi", "sq", fake);
    expect(out).toEqual({ workspaceId: "al-steel-construction-ab12", apiKey: "kd_x" });
    expect(sent!.url).toBe("https://k.test/v1/setup/company");
    expect((sent!.init.headers as Record<string, string>)["x-setup-token"]).toBe("tok");
    expect(JSON.parse(String(sent!.init.body))).toMatchObject({ name: "AL-Steel Construction", trade: "metal", country: "AL", lang: "sq", apiKey: true });
  });
});

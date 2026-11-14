import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { publicDemoMetadata } from "./public-demo-seo";

describe("Public demo metadata boundaries", () => {
  const base: Metadata = {
    title: "Existing customer identity",
    description: "Existing customer description",
    robots: { index: true, follow: true },
    icons: { icon: "/brand.png" },
    appleWebApp: { title: "Existing PWA" },
  };

  it.each([
    ["redionflow-production.up.railway.app", "BaumdienstFlow"],
    ["bauflow-production-1344.up.railway.app", "BauFlow"],
    ["BAUFLOW-PRODUCTION-1344.UP.RAILWAY.APP:443", "BauFlow"],
  ])("identifies the exact public host %s", (host, product) => {
    const result = publicDemoMetadata(host, base);
    expect(result.title).toBe(`${product} · öffentliche Demo`);
    expect(result.description).toContain("Fiktive Beispieldaten");
    expect(result.description).toContain(product === "BauFlow" ? "/bauflow/" : "https://www.baumdienstflow.de/");
    expect(result.robots).toEqual({ index: false, follow: true });
    expect(result.icons).toBe(base.icons);
    expect(result.appleWebApp).toBe(base.appleWebApp);
    expect(base.title).toBe("Existing customer identity");
    expect(base.robots).toEqual({ index: true, follow: true });
  });

  it.each([null, "localhost:3100", "www.baumdienstflow.de", "baumdienstflow.info", "customer.example.invalid", "bauflow-production-1344.up.railway.app.evil.test", "evil-bauflow-production-1344.up.railway.app", "redionflow-productionXupXrailwayXapp"])("preserves all customer metadata for %s", (host) => {
    expect(publicDemoMetadata(host, base)).toBe(base);
  });
});

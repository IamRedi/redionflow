import { describe, expect, it } from "vitest";

import { parseNumber, parseOrderText, sameSiteName } from "./order-parse";

const SAMPLE = `Çeliku Shpk
Fletë porosie
Nr. porosie: P-2026-118
Klienti: AL-Steel Construction shpk
Kantieri: Kapanoni Logjistik Vorë
Adresa e kantierit: Rruga e Industrisë, Vorë, Tiranë
1 Kolona HEA 300 L=7,5 m 12,5 t 98.000 lek 1.225.000 lek
2 Trarë IPE 240 6 t 95.000 lek 570.000 lek
3 Pllaka bazë 400×400 mm 36 copë 1.200 lek 43.200 lek
4 Llamarinë mbulese 0,6 mm 850 m2 900 lek 765.000 lek
5 Bulona M24 kl. 10.9 320 copë 260 lek 83.200 lek
Totali me TVSH: 2.603.200,00 lek`;

describe("supplier order parsing", () => {
  it("reads site, address, reference and the material lines", () => {
    const draft = parseOrderText(SAMPLE);
    expect(draft.siteName).toBe("Kapanoni Logjistik Vorë");
    expect(draft.address).toBe("Rruga e Industrisë, Vorë, Tiranë");
    expect(draft.reference).toBe("P-2026-118");
    expect(draft.client).toBe("AL-Steel Construction shpk");
    expect(draft.supplier).toBe("Çeliku Shpk");
    expect(draft.total).toBe(2603200);
    expect(draft.currency).toBe("ALL");
    expect(draft.lines).toEqual([
      { title: "Kolona HEA 300 L=7,5 m", quantity: 12.5, unit: "t", price: 1225000 },
      { title: "Trarë IPE 240", quantity: 6, unit: "t", price: 570000 },
      { title: "Pllaka bazë 400×400 mm", quantity: 36, unit: "pcs", price: 43200 },
      { title: "Llamarinë mbulese 0,6 mm", quantity: 850, unit: "m2", price: 765000 },
      { title: "Bulona M24 kl. 10.9", quantity: 320, unit: "pcs", price: 83200 },
    ]);
  });

  it("parses numbers in Albanian, German and English style", () => {
    expect(parseNumber("1.234,50")).toBe(1234.5);
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1.250")).toBe(1250);
    expect(parseNumber("0.6")).toBe(0.6);
  });

  it("matches site names ignoring case and diacritics", () => {
    expect(sameSiteName("Teatri Kombëtar", "teatri kombetar")).toBe(true);
    expect(sameSiteName("Teatri", "Teatri Kombëtar")).toBe(false);
  });
});

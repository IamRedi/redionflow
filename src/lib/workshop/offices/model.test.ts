import { describe, expect, it } from "vitest";
import { canReadDocument, emptyOfficeState, officeCapabilities, officeEnvelope, officeVisibleState, quoteTotals, defaultOfficeOverhead } from "./model";
describe("Muster office boundaries", () => {
  it("keeps colleagues' private archive, notes and chat out of every other office, including the manager", () => {
    const s = emptyOfficeState(), at = "2026-11-13T10:00:00Z";
    s.documents.push({ id: "00000000-0000-4000-8000-000000000001", owner: "finance", shared: false, archived: false, siteIds: [], at });
    s.tasks.push({ id: "00000000-0000-4000-8000-000000000002", owner: "finance", title: "Private personnel note", text: "Not for other offices", status: "todo", archived: false, at });
    s.turns.push({ id: "00000000-0000-4000-8000-000000000003", owner: "finance", question: "Private", answer: "Private answer", status: "completed", model: "fixture", at });
    expect(officeVisibleState(s, "manager").documents).toEqual([]); expect(officeVisibleState(s, "operations").tasks).toEqual([]); expect(officeVisibleState(s, "clients").turns).toEqual([]);
    expect(officeVisibleState(s, "finance").tasks).toHaveLength(1);
    s.documents[0].shared = true; expect(canReadDocument(s.documents[0], "operations")).toBe(true);
    s.documents[0].archived = true; expect(canReadDocument(s.documents[0], "operations")).toBe(false); expect(canReadDocument(s.documents[0], "finance")).toBe(true);
  });
  it("separates staff reporting, worksite creation and offers instead of granting all office roles admin", () => {
    expect(officeCapabilities("finance")).toMatchObject({ staff: true, site: false, quote: false });
    expect(officeCapabilities("operations")).toMatchObject({ staff: false, site: true, quote: false });
    expect(officeCapabilities("clients")).toMatchObject({ staff: false, site: false, quote: true });
    expect(officeCapabilities("reception")).toMatchObject({ staff: false, site: false, quote: false });
  });
  it("uses the existing cents calculator and rejects client-supplied principals or unbounded cost input", () => {
    const q = { title: "Muster tree care", client: "Fictional client", laborCents: 10000, machineCents: 0, materialCents: 0, externalCents: 0, overhead: { ...defaultOfficeOverhead, bgkPct: 0, agkPct: 0, riskPct: 0, profitPct: .1, vatPct: .19 } };
    expect(quoteTotals(q).offer).toEqual({ netCents: 11000, vatCents: 2090, grossCents: 13090 });
    const envelope = { requestId: "00000000-0000-4000-8000-000000000004", revision: 0, command: { type: "quote", quote: q } };
    expect(officeEnvelope.safeParse({ ...envelope, actor: "manager" }).success).toBe(false);
    expect(officeEnvelope.safeParse({ ...envelope, command: { type: "quote", quote: { ...q, laborCents: 1e12 } } }).success).toBe(false);
  });
});

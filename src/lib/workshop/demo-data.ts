import type { WorkshopAsset, WorkshopState } from "./demo-model";
import { emptyCustody } from "./custody-schema";

export function createWorkshopDemo(): WorkshopState {
  const asset = (id: string, name: string, code: string, kind: "fleet" | "tool", inspection = "2027-06-30", holder = ""): WorkshopAsset => ({ id, name, code, kind, inspection, holder, location: holder || "Lager", events: [] });
  return {
    version: 3,
    custody: emptyCustody(),
    movements: [],
    assets: [asset("chipper", "Häcksler", "MU-BD 201", "fleet"), asset("truck", "LKW 7,5 t", "MU-BD 101", "fleet", "2027-05-31", "Jonas Becker"), asset("platform", "Hubarbeitsbühne 27 m", "MU-BD 301", "fleet"), asset("crane", "Kran-LKW", "MU-BD 401", "fleet"), asset("saw", "Motorsäge", "WG-101", "tool"), asset("pole-saw", "Stangensäge", "WG-102", "tool", "2027-05-31", "Arben Berisha"), asset("blower", "Laubbläser", "WG-103", "tool"), asset("harness", "Klettergurt", "PSA-201", "tool", "2026-10-31")].map(a => {
      if (a.id === "chipper" || a.id === "saw") { a.location = "Werkstatt"; a.events = [{ id: `received-${a.id}`, kind: "received", at: "2026-11-04T08:10:00.000Z", actor: "Demo", ref: a.id === "saw" ? "WS-102" : "WS-101", note: a.id === "saw" ? "Kettenbremse ohne Funktion" : "Hydraulikleitung undicht" }]; }
      if (a.id === "chipper") a.events.unshift({ id: "start-chipper", kind: "started", at: "2026-11-04T10:10:00.000Z", actor: "Demo", ref: "WS-101", note: "Werkstatt-Team" });
      if (a.id === "platform") a.events = [
        { id: "release-platform", kind: "released", at: "2026-11-03T12:00:00.000Z", actor: "Demo", ref: "WS-100", note: "" },
        { id: "repair-platform", kind: "repaired", at: "2026-11-03T11:30:00.000Z", actor: "Demo", ref: "WS-100", note: "Leuchtmittel ersetzt, Funktion geprüft." },
        { id: "part-platform", kind: "part", at: "2026-11-03T10:30:00.000Z", actor: "Demo", ref: "WS-100", note: "1 × LED-Arbeitsleuchte" },
        { id: "start-platform", kind: "started", at: "2026-11-02T10:00:00.000Z", actor: "Demo", ref: "WS-100", note: "Werkstatt-Team" },
        { id: "receive-platform", kind: "received", at: "2026-11-02T08:10:00.000Z", actor: "Demo", ref: "WS-100", note: "Arbeitsscheinwerfer defekt" },
      ];
      return a;
    }),
    jobs: [
      { id: "WS-102", assetId: "saw", problem: "Kettenbremse ohne Funktion", priority: "urgent", status: "received", assignee: "Werkstatt-Team", createdAt: "2026-11-04T08:10:00.000Z", repairNote: "", tested: false, parts: [] },
      { id: "WS-101", assetId: "chipper", problem: "Hydraulikleitung undicht", priority: "urgent", status: "repairing", assignee: "Werkstatt-Team", createdAt: "2026-11-04T08:10:00.000Z", repairNote: "", tested: false, parts: [] },
      { id: "WS-100", assetId: "platform", problem: "Arbeitsscheinwerfer defekt", priority: "normal", status: "repaired", assignee: "Werkstatt-Team", createdAt: "2026-11-02T08:10:00.000Z", repairedAt: "2026-11-03T11:30:00.000Z", releasedAt: "2026-11-03T12:00:00.000Z", repairNote: "Leuchtmittel ersetzt, Funktion geprüft.", tested: true, parts: [{ id: "lamp", name: "LED-Arbeitsleuchte", qty: 1, unitCents: 2400 }] },
    ],
    parts: [{ id: "hydraulic", name: "Hydraulikschlauch", stock: 3, minimum: 2, unitCents: 4800 }, { id: "chain", name: "Sägekette", stock: 2, minimum: 3, unitCents: 2900 }, { id: "filter", name: "Luftfilter", stock: 8, minimum: 3, unitCents: 1200 }, { id: "lamp", name: "LED-Arbeitsleuchte", stock: 4, minimum: 2, unitCents: 2400 }],
    documents: [{ id: "demo-work-order", name: "DEMO-Werkstattauftrag-WS-101.txt", assetId: "chipper", jobId: "WS-101", mime: "text/plain", bytes: 172, at: "2026-11-04T08:10:00.000Z", data: "DEMO / FICTIONAL DATA\nWS-101 - MU-BD 201\nHydraulikleitung undicht. Nicht einsetzen, bis Reparatur, Funktionspruefung und Freigabe dokumentiert sind.\nKeine echte Pruefbescheinigung." }],
  };
}

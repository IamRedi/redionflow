import { describe, expect, it } from "vitest";
import { siteFromSavedRows } from "./plan-site-rule";

const sites = [{ id: "s1", name: "Shkalla Sauk" }, { id: "s2", name: "Ferma Laknas" }];
const rows = [
  { workerNames: "Lutfi Ç, Nuri L", baustelleName: "Ferma Laknas" },
  { workerNames: "Naim Kuka, Ervis Xhani", baustelleName: "Shkalla  Sauk" },
];

describe("siteFromSavedRows", () => {
  it("finds the worker's site by full name, ignoring case, accents and spaces", () => {
    expect(siteFromSavedRows(rows, "naim kuka", sites)).toEqual(sites[0]);
    expect(siteFromSavedRows(rows, "Lutfi C", sites)).toEqual(sites[1]);
  });
  it("gives nothing for unknown people, partial names or unknown or duplicate sites", () => {
    expect(siteFromSavedRows(rows, "Naim", sites)).toBeNull();
    expect(siteFromSavedRows(rows, "Iris M", sites)).toBeNull();
    expect(siteFromSavedRows([{ workerNames: "Ana B", baustelleName: "Tjetër" }], "Ana B", sites)).toBeNull();
    expect(siteFromSavedRows([{ workerNames: "Ana B", baustelleName: "Ferma Laknas" }], "Ana B", [...sites, { id: "s3", name: "Ferma Laknas" }])).toBeNull();
  });
});

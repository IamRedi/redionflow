import { expect, it } from "vitest";

import { matchAccessNames, parseAccessNames } from "./access-grant";

const people = [
  { kind: "admin" as const, id: "u1", fullName: "Megi Hoxha", firstName: "Megi" },
  { kind: "worker" as const, id: "w1", fullName: "Almet Kola", firstName: "Almet" },
  { kind: "worker" as const, id: "w2", fullName: "Arben Shehu", firstName: "Arben" },
  { kind: "worker" as const, id: "w3", fullName: "Arben Dervishi", firstName: "Arben" },
];

it("parses a comma list once per name", () => {
  expect(parseAccessNames(" Megi, Almet ,Megi,")).toEqual(["Megi", "Almet"]);
  expect(parseAccessNames(undefined)).toEqual([]);
});

it("matches first or full names, ignoring case and accents", () => {
  const [megi, almet] = matchAccessNames(["mégi", "ALMET KOLA"], people);
  expect(megi.matches.map(p => p.id)).toEqual(["u1"]);
  expect(almet.matches.map(p => p.id)).toEqual(["w1"]);
});

it("reports ambiguous and unknown names instead of guessing", () => {
  const [arben, nobody, exact] = matchAccessNames(["Arben", "Ilir", "Arben Shehu"], people);
  expect(arben.matches).toHaveLength(2);
  expect(nobody.matches).toHaveLength(0);
  expect(exact.matches.map(p => p.id)).toEqual(["w2"]);
});

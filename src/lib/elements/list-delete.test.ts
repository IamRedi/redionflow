import { expect, it } from "vitest";

import { mayDeleteElementList } from "./list-delete";

it("keeps the default rule when no names are configured", () => {
  expect(mayDeleteElementList("Anyone Else", true, "")).toBe(true);
  expect(mayDeleteElementList("Anyone Else", false, undefined)).toBe(false);
});

it("allows only the named people, by full or first name, ignoring accents and case", () => {
  const only = "Megi, Silvi";
  expect(mayDeleteElementList("Megi Tollumi", false, only)).toBe(true);
  expect(mayDeleteElementList("silvi example", false, only)).toBe(true);
  expect(mayDeleteElementList("Hrisa Hila", true, only)).toBe(false);
  expect(mayDeleteElementList("Megiana Example", true, only)).toBe(false);
  expect(mayDeleteElementList(null, true, only)).toBe(false);
  expect(mayDeleteElementList("Mégi Example", false, only)).toBe(true);
});

import { describe, expect, it } from "vitest";

import enJson from "@/locales/en.json";
import itJson from "@/locales/it.json";
import plJson from "@/locales/pl.json";
import roJson from "@/locales/ro.json";
import sqJson from "@/locales/sq.json";
import { de, en, type SparseDictionary, type TranslationKey } from "./dictionaries";

function leafPaths(dict: SparseDictionary, prefix = ""): string[] {
  return Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : leafPaths(value, path);
  });
}

const germanKeys = new Set(leafPaths(de));

describe("locale JSON files", () => {
  it.each([
    ["en", enJson],
    ["it", itJson],
    ["pl", plJson],
    ["ro", roJson],
    ["sq", sqJson],
  ] as const)("%s only translates keys that exist in de.json", (_lang, dict) => {
    expect(leafPaths(dict).filter((path) => !germanKeys.has(path))).toEqual([]);
  });

  it("fills untranslated keys from German", () => {
    expect(leafPaths(en).length).toBe(germanKeys.size);
  });

  it("types keys as dot-paths of de.json", () => {
    const key: TranslationKey = "common.save";
    expect(germanKeys.has(key)).toBe(true);
  });
});

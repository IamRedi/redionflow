/**
 * Translation dictionaries, loaded from `src/locales/*.json`.
 *
 * `de.json` is the canonical source and defines the key shape. The other
 * languages only store the strings they actually translate; every missing
 * key falls back to German here, so all dictionaries share the German shape.
 * `t()` then treats an inherited German value as "not translated" and prefers
 * English for non-German users.
 */
import deJson from "@/locales/de.json";
import enJson from "@/locales/en.json";
import itJson from "@/locales/it.json";
import plJson from "@/locales/pl.json";
import roJson from "@/locales/ro.json";
import sqJson from "@/locales/sq.json";

export type Dictionary = typeof deJson;

export type SparseDictionary = { [key: string]: SparseDictionary | string };

/** Every dot-path that ends in a string, e.g. `"common.save"`. */
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPaths<Dictionary>;

function mergeOver(base: SparseDictionary, overrides: SparseDictionary): SparseDictionary {
  const out: SparseDictionary = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object" ? mergeOver(current, value) : value;
  }
  return out;
}

function withGermanFallback(overrides: SparseDictionary): Dictionary {
  // The merge result has the German shape by construction.
  return mergeOver(deJson, overrides) as Dictionary;
}

export const de: Dictionary = deJson;
export const en = withGermanFallback(enJson);
export const it = withGermanFallback(itJson);
export const pl = withGermanFallback(plJson);
export const ro = withGermanFallback(roJson);
export const sq = withGermanFallback(sqJson);

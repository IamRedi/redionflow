import { describe, expect, it } from "vitest";
import { pickLanguageFromAcceptHeader } from "./language";

describe("pickLanguageFromAcceptHeader", () => {
  it("returns null for empty or unsupported input", () => {
    expect(pickLanguageFromAcceptHeader(null)).toBeNull();
    expect(pickLanguageFromAcceptHeader("")).toBeNull();
    expect(pickLanguageFromAcceptHeader("zh-CN")).toBeNull();
  });

  it("returns the first supported language, ignoring region tag", () => {
    expect(pickLanguageFromAcceptHeader("en-US,en;q=0.9")).toBe("en");
    expect(pickLanguageFromAcceptHeader("it-IT")).toBe("it");
    expect(pickLanguageFromAcceptHeader("sq-AL,sq;q=0.9")).toBe("sq");
  });

  it("respects q-values so higher priority wins", () => {
    expect(pickLanguageFromAcceptHeader("zh;q=0.9,en;q=0.5,de;q=0.8")).toBe("de");
  });

  it("skips unsupported entries and returns the next supported one", () => {
    expect(pickLanguageFromAcceptHeader("fr-FR,zh-CN,en-GB")).toBe("en");
  });
});

import { describe, expect, it } from "vitest";

import { t } from "./index";

describe("i18n translator", () => {
  it("falls back to English before German for missing target-language keys", () => {
    expect(t("language.switchLabel", "sq")).toBe("Language");
    expect(t("language.switchLabel", "it")).toBe("Lingua");
  });

  it("treats inherited German values as missing when English has a real translation", () => {
    expect(t("common.photo", "sq")).toBe("Photo");
  });

  it("falls back to the key path only when no dictionary has the key", () => {
    expect(t("missing.translation.path", "it")).toBe("missing.translation.path");
  });

  it("uses BauFlow terminology overrides without changing Baumdienst wording", () => {
    expect(t("workzone.treeDiameter", "sq", "bau")).toBe("Sasia / Masat");
    expect(t("workzone.treeShort", "sq", "bau")).toBe("Detyra");
    expect(t("workzone.scanTree", "sq", "bau")).toBe("Skano detyrën");
    expect(t("workzone.scanTreeDescription", "sq", "bau")).toContain("Detyra përkatëse");
    expect(t("workzone.treeDiameter", "it", "bau")).toBe("Quantita / misura");
    expect(t("workzone.treeDiameter", "de", "baumdienst")).toBe("Durchmesser / StU");
    expect(t("workzone.scanTree", "sq", "baumdienst")).toBe("Skano pemen");
  });
});

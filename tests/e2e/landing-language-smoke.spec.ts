import { expect, test } from "@playwright/test";

const languageCases = [
  {
    lang: "de",
    expected: "Workzone, Tagesplanung und Berichte in einem klaren Betriebssystem.",
  },
  {
    lang: "en",
    expected: "Workzone, daily planning and reports in one clear operating system.",
  },
  {
    lang: "it",
    expected: "Workzone, piano giornaliero e report in un sistema operativo chiaro.",
  },
  {
    lang: "pl",
    expected: "Workzone, plan dnia i raporty w jednym jasnym systemie operacyjnym.",
  },
  {
    lang: "ro",
    expected: "Workzone, plan zilnic si rapoarte intr-un sistem operational clar.",
  },
  {
    lang: "sq",
    expected: "Workzone, plan ditor dhe raporte ne nje sistem operativ te qarte.",
  },
] as const;

test.describe("landing language smoke", () => {
  for (const { lang, expected } of languageCases) {
    test(`renders landing copy in ${lang}`, async ({ page }) => {
      await page.goto("/landing");

      const selector = page.locator("#landing-language");
      await expect(selector).toBeVisible();
      // Visible SSR controls can precede their client change handler.
      await expect(async()=>{
        await selector.selectOption(lang);
        expect(await page.evaluate(()=>localStorage.getItem("bk_lang"))).toBe(lang);
      }).toPass({timeout:10_000});

      await expect(selector).toHaveValue(lang);
      await expect(page.getByText(expected, { exact: true })).toBeVisible();
    });
  }
});

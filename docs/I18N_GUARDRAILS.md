# i18n guardrails

These four automated tests in `src/lib/i18n/i18n-guardrails.test.ts` run
on every `npm test` and block PRs that would regress internationalization.

They exist because the BDF-P8-007 remediation series (PRs #14–#31)
uncovered the same four classes of bugs over and over, and manual audits
missed them until a customer noticed.

## What each guardrail catches

### 1. Missing `t()` keys

If code calls `t("workzone.newKey")` and no dictionary defines it, the
UI renders the raw dot-notation (`"workzone.newKey"`) in every language.

The test walks every `.ts` / `.tsx` under `src/` (except the dictionaries
themselves and generated code), scrapes out every `t("…")` call, and
asserts the key exists in `de.ts`.

**Fix on failure**: add the missing key to `src/lib/i18n/de.ts`. Ideally
add it to `en.ts`, `it.ts`, `sq.ts` at the same time — the language files
fall back to German, so the app won't crash, but a missing English
translation renders German for English users.

### 2. Mode-override drift (`bau`)

When a company runs in BauFlow mode, `mode-overrides.ts`
overlays alternative wording on top of the base dictionary
(e.g. `"Baum"` → `"Arbeit"`). If someone adds a DE override without also
adding it in EN/IT/SQ/PL/RO, non-DE BauFlow users see the German
override leak through.

The test asserts that the key set present in the DE override for `bau`
(and separately for `personal`) exists in all five other languages.

**Fix on failure**: mirror the DE override into the language blocks
listed by the failure message.

### 3. Hardcoded `de-DE` locale

`.toLocaleString("de-DE")`, `.toLocaleDateString("de-DE")`, and
`new Intl.NumberFormat("de-DE", …)` silently render German number and
date formats for every user regardless of their UI language. The
production code should always route through one of the shared helpers:

- `formatCount(value, lang)` from `src/lib/workzone/date-utils.ts` for
  integer counts.
- `formatEUR(cents, lang)` from `src/lib/calculation/formatters.ts` for
  monetary values.
- `reportLocale(lang)` for any custom `Intl.*` call.
- `weekRangeLocale(lang)` inside dashboard snapshots.

The test asserts that no file under `src/` embeds the literal
`"de-DE"` (or `de-CH`, `de-AT`) except the whitelisted helpers.

**Fix on failure**: replace the literal with a call through one of the
helpers, passing the caller's `currentLang`. If the file is genuinely a
locale helper, add it to `ALLOWED_DEDE_FILES` in the test.

There's a "grandfathered" list in the whitelist for surfaces that landed
in flight during the BDF-P8-007 series. As those PRs merge to `main`,
shrink the list — the goal is `ALLOWED_DEDE_FILES` containing only the
core helpers.

### 4. Broken DE dictionary leaves

Two subtle bugs in `de.ts`:

- Empty string or literal `"undefined"` at a leaf — usually a bad
  auto-completion. Renders as blank in the UI.
- A leaf whose value is itself a valid key path (e.g.
  `save: "common.save"` instead of `save: "Speichern"`). The `t()`
  lookup returns the dot-notation, which then renders as text.

**Fix on failure**: replace the leaf with the actual translation.

## Running locally

```bash
npm test -- src/lib/i18n/i18n-guardrails.test.ts
```

The full test suite (`npm test`) runs them alongside every other test.

## When to loosen a guardrail

Almost never. If you genuinely need to embed `"de-DE"` (e.g. you're
adding a new locale helper), add the file path to `ALLOWED_DEDE_FILES`
with a comment explaining why. Do NOT disable the test.

If you need to skip a key from the missing-key check (e.g. a
dynamically-composed key from a variable), the safer fix is to enumerate
the possible keys statically so the guardrail can see them.

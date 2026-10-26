# Multi-language plan

Goal: RediOnFlow becomes a serious product for German, Albanian, English,
and Italian markets. Workers already switch language per profile; the
office/admin UI has to follow. No duplicated code, no forked components —
one dictionary system, one `t()`, mode-aware overrides on top.

## Policy (owner-confirmed 2026-07-24, BDF-P8-007)

- **First-class office/admin languages** — the full admin surface must
  render in these when the admin selects the language:
  - **de** (source of truth, source dictionary)
  - **en**, **it**, **sq**
- **Worker-only languages** — kept because worker profile stores the
  preference and the workzone must render for the worker; the office
  admin UI is not required to render fully in these:
  - **pl**, **ro**
  - Coverage stays low on purpose; the `t()` fallback chain resolves to
    English (or German) for any office string that has no pl/ro value.
- Baseline coverage (`npm run i18n:coverage`, 2026-07-24):
  - en 70.8 %, it 73.4 %, sq 78.3 %, pl 25.8 %, ro 25.9 %.
- Anti-drift is enforced by `src/lib/i18n/coverage.test.ts`. Any PR that
  adds a German key without translating it in en / it / sq bumps
  `germanFallbackCount` above the ceiling and fails CI. As real
  translations land, lower the ceilings in the same PR.

Current state (2026-07-06)
--------------------------

- `src/locales/` holds the dictionaries as JSON: `de` (canonical, full key set) and sparse `en`, `it`, `sq`, `pl`, `ro` that fall back to German (`src/lib/i18n/dictionaries.ts`). BauFlow wording lives in `src/locales/bau/<lang>.json`.
- `t(path, lang?, mode?)` reads the dictionary + `mode-overrides` (T-029).
- `LanguageProvider` (client) + `resolveRequestLanguage` (server) resolve
  the active language from cookie → worker profile → default `de`.
- Prisma enum `AssistantLanguage = { DE, SQ, PL }` on `User` and `Worker`.
  Currently the DB does not model `EN`, `RO`, or `IT` — resolution happens
  at the i18n layer, not in the DB.
- Many admin pages hold hard-coded German strings that never go through
  `t()`. A few page shells (workzone home, baustelle detail) are wired.

Target
------

Four first-class languages: **de**, **en**, **sq**, **it**.  Retire the
`pl` and `ro` dictionaries from the primary product surface but keep the
files so old worker profiles with those preferences still resolve (fall
back to English if a Polish/Romanian string is missing).

Every office/admin screen switches language via a single header control.
Worker screens keep the existing per-worker preference (unchanged).

Delivery in three phases so we ship working, non-breaking increments:

Phase 1 — Language plumbing (this pass)
---------------------------------------

- Add `it.ts` Italian dictionary next to the existing files.
- Extend `SUPPORTED_LANGUAGES` and `Language` types to include `it`.
- Extend `mapProfileLanguage` so `IT` maps to `it`.
- Extend `AssistantLanguage` Prisma enum with `IT` (nullable migration —
  no existing data broken).
- Extend signup and admin language dropdowns to offer four options
  (de / en / sq / it).
- Verify: existing pl/ro users still load, existing worker language
  preference still resolves.

**Ship criteria**: switching an admin's language via cookie to `it`
renders the workzone home page and the pages already wired through `t()`
in Italian (only the strings that exist in `it.ts` — the rest fall back
to English or German gracefully). No regressions on de/sq.

Phase 2 — Admin coverage sweep
------------------------------

Sweep the admin surfaces in this order:

1. `docs/AI_ASSISTANT.md`-visible pages first: dashboard, admin panel,
   settings, profile.
2. Baustelle admin: list, detail, import.
3. Projects + templates + calculation.
4. Inventory + safety + fleet.
5. Reports + audit + portability.

For each page:

- Identify every hard-coded German string.
- Replace with a `t("key", lang, mode)` call using a fresh key when needed.
- Add the key to every dictionary (missing values fall back to German
  gracefully via `t()`).
- Run `npm run typecheck` after each page.

Naming convention: `<area>.<screen>.<element>` — e.g.
`admin.settings.overheadsHeading`, `admin.baustellen.emptyState`.

**Ship criteria**: switching cookie to `it` renders every admin surface
without German residue on visible headings and buttons. Body prose can
land later.

Phase 3 — Polish
----------------

- Admin sidebar carries a language switcher (currently only workers
  have one).
- Browser locale detection on the first landing (Accept-Language header)
  so an Italian visitor lands on `it` even without a cookie.
- Language selection on `/signup` so a new SaaS tenant picks their
  operating language up front. Cookie is set immediately after signup.
- Landing page localisation (three product tabs already have German
  copy; add `it` and `en` versions in `landingContent`).
- Retire `pl` and `ro` from the SUPPORTED list once no worker profile
  still holds `PL` or `RO`. The dictionaries stay in the repo for
  historical accuracy but drop out of `SUPPORTED_LANGUAGES`.

Guard rails
-----------

- Zero code duplication: dictionaries live under `src/lib/i18n`, mode
  overrides in `src/locales/bau/`, both consumed via `t()`.
- Fallback chain: mode override → target language → English → German.
  Missing keys never render the raw dot-notation to the user.
- Assistant responses (OpenAI) continue to honor the caller's language
  via the existing `languageForTurn` helper. No parallel prompt fork.
- Server components read language from cookie; client components read it
  through `LanguageProvider`. Never mix.

Non-goals (for now)
-------------------

- Right-to-left languages. All four target languages are LTR.
- Locale-specific number/date formatting. Reports render in `de-DE`
  format for now; localise dates/currency in a later pass alongside VAT.
- Country-specific legal copy (Impressum, AGB). Localise text; keep the
  legal jurisdiction as-is unless a customer opens a company in that
  country.

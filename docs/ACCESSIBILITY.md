# Accessibility notes

BDF-P8-007 tracks accessibility (WCAG 2.1 AA) as a market-readiness
gate. This file summarises what has landed and what is still open.

## Landed

### Never colour-only for status (WCAG 1.4.1)

Two surfaces were previously colour-only:

- **`InspectionDot`** (admin/page.tsx) — HU / SP / UVV inspection
  chips. Now every dot carries a distinct glyph (`✓ / ! / ✗ / –`)
  inside the coloured circle AND an `aria-label` on the wrapping
  `<span role="group">` that reads
  `"HU: valid, 03/26"` for a screen reader.
- **`WorkerIconStrip`** (workzone/worker-icon-strip.tsx) — worker
  avatars in the top bar. The button now carries a full
  `aria-label` including the translated availability
  (`SICK / VACATION / UNAVAILABLE / AVAILABLE`) plus live/offline
  so a keyboard-only user knows why a chip is coloured without
  seeing the tint.

### Translations
`admin.inspectionStatusOk / Warning / Expired / Unknown` keys ship in
de/en/it/sq. Existing `workzone.sickStatus / vacationStatus /
unavailableStatus / availableStatus` keys are already localised for
worker chips.

## Open (tracked in `MARKET_READY_BACKLOG.md`)

### Keyboard focus outlines
Tailwind `focus-visible:ring-*` is used inconsistently. Some
interactive `<div onClick=…>` sites still have no keyboard
affordance. The migration path is:
1. Enable `jsx-a11y/no-noninteractive-element-interactions` as an
   ESLint error.
2. Migrate offenders to `<button>` / `<Link>` so the browser gives us
   focus rings for free.
Requires a design pairing session because some sites reproduce a
custom dropdown pattern.

### Colour contrast
No systematic audit yet. Tailwind palette defaults (emerald-500 on
white, amber-400 on white) sit near the 4.5:1 WCAG AA floor; a11y
tooling should be part of the CI pipeline before shipping to gov /
enterprise procurement.

### `alt` fallback wording
`AppBrand` accepts a `logoAlt` prop; the default is German
`"Firmenlogo"`. Every real caller passes a translated value, but a
future contributor could forget. Promote `logoAlt` to a required
prop once the guardrail test stops flagging any missed call site.

### Full keyboard navigation of the mission map
Leaflet ships keyboard focus for markers but the popup / focus button
uses a mouse-first flow. Owed a dedicated pass.

## Testing

Run any real screen reader (VoiceOver / NVDA / Orca) against these
two surfaces after the PR merges:

- `/app/admin` machine cards → expect "HU: valid, 03/26" not
  "HU: 03/26".
- `/workzone` top bar → expect "Ali Kadolli - sick (offline)" not
  "Ali Kadolli - offline".

## Why not do WCAG 2.4.7 in this PR
Focus-outline compliance touches ~30 interactive `<div>` sites and
needs a design decision on whether to unify to shadcn Button /
DropdownMenu. Keeping the two surface fixes here so the PR stays
reviewable and reversible.

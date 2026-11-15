# Crane Muster — clean company creation rehearsal

Owner request: 15 November 2026. Test a new crane-service company from the shared
BauFlow base, with its own records and factory disabled. This is a fictional,
isolated local rehearsal, not an installation for Kranservice Solle.

## Reference and scope

The public [Solle service list](https://www.kranservice-solle.de/leistungen)
and [fleet](https://www.kranservice-solle.de/fuhrpark), reviewed on 15 November,
informed the choice of crane assistance, glass installation, rooftop lifting,
tracked handling equipment and steel assembly scenarios. No customer records,
employee identities, contact details, photos, logos or load tables are imported.

The fictional **RheinRuhr Kranservice Muster GmbH** uses
`steel-assembly@1` with an explicit `factory:false`. Its three job sites remain
assembly sites internally, reusing the existing field/document/element engine.
Its own six selected tasks describe preparation, access/standing area,
barriers, delivery, lifting/assembly documentation and handover. No production
task, factory site, batch or manufactured material history is seeded.

`examples/company-crane-muster.json` is the operator input example. The normal
`company:plan` command previews it offline, binds the exact input and immutable
profile to a digest, then creates the company atomically in an explicitly
reviewed database. Passwords remain outside that file. Source baseline is the
PR222 Muster release `4820fcf9ebd233f0fa14378623dda1e4fad58dbd`.

## One engine, own configuration and records

- The reviewed business profile remains immutable. Company-owned `uiIdentity`
  is separate from that profile and from authorization. It accepts only the
  bundled `crane-red-blue-v1` visual kit; null preserves every existing firm's
  appearance. SQL restricts it to BauFlow. It accepts no arbitrary CSS or URLs.
- Authenticated rendering selects the current company's identity explicitly;
  no first-company/name inference. Original SVG logo is supplied as company
  data. Public install icons continue through the existing dedicated brand path.
- The shared compact catalog styles use one explicit applicability marker for
  the existing BauFlow Muster and the selected new visual kit. Their styling
  rules are reused, without a second inventory/fleet implementation. The old
  Muster flag and its public-role entry remain exclusive to that old demo.
- The visual lock is BauFlow's existing ice glass, component/icon family,
  typography and compact controls, with the owner-requested red/blue accents.
  The kit lives in `src/components/steel/company-ui.css` and
  `public/company-studio/crane-red-blue-v1/`. Day/Night yard scenes and the job
  covers are original generated illustrations. Transparent equipment images
  retain their alpha. Actual dimensions and hashes are in `provenance.json`;
  exact image model is not exposed by the built-in generation tool.
- Necessary working scroll remains in the primary workspace. The new kit hides
  decorative scrollbar chrome, preserves real scrolling and restores native
  chrome in forced colors. The existing natural footer/About exception remains.

## Fictional operational scenario

`scripts/seed-crane-muster.ts` is an optional local-only scenario command, after
normal onboarding. It is absent from startup, ordinary seed and reset hooks.
It requires the exact company, local enable flag, loopback database
`bauflow_crane_muster_test`, and an otherwise empty dedicated installation.
It refuses unexpected company identity or existing operational records.
One transaction and an advisory lock create the scenario; its completion audit
makes a retry a no-op, preserving later edits and credentials.

The firm has its own owner, seven fictional staff, three office memberships,
three jobs, two machines, four identified tools, eighteen selected job tasks,
three job documents, equipment documents and one initial workshop example.
The two-day plan has no repeated person or machine within a day. Work sessions,
office tasks and saved plan snapshots belong only to this firm.

The road vehicle is identified by its fictional plate. A barcode is optional.
Tools have distinct `RK-WZ-*` label identities attached to the canonical asset
record. Receiving, worker custody, transfer and repair reuse that same record.
The sender's explicit transfer request records their signature; the receiver
must still confirm. Transfer never signs on behalf of the other colleague.
Return requires the counterpart's confirmation too. A defect blocks use until
the repair passes received → repairing → ready, with an actual recorded test
and evidence/note. Initial demo data is explicitly fictional, not a real test.

Supplied assemblies use `supply:external`, no factory stages and only field
receiving/mounting. Office documents, staff hours and job links use the existing
permissions and tenant boundaries. AI, email, GPS and external integrations stay
disabled; no provider credential, paid account or external subscription is
created. The fourteen-day trial is local application data, not a payment.

## Acceptance and limits

The executable crane integration scenario exercises creation/retry, distinct
staff/planning, plate-versus-barcode identity, exact scanning, two-person custody
and transfer, return, defect blocking, mechanic repair, evidence retention,
external material receiving, direct factory denial and a foreign synthetic
sentinel. Its real request identity uses signed test cookies and the ordinary
actor/permission loader, not a mocked business role.

Release receipts must separately record full regression checks, actual CLI
creation, production build, rendered desktop/touch themes and exact source.
Physical NFC/camera hardware, printing, physical-phone acceptance and live
deployment are separate. This rehearsal does not ship crane dispatch conflict
resolution, certified operator eligibility, load/radius or ground calculations,
engineering lifting plans, crane-specific quotation rules or automatic safety
approval. Those need a separately reviewed industry adaptation.

No AL Steel, BaumdienstFlow, existing demo or portfolio deployment is part of
this rehearsal. The new nullable visual column does not enroll existing firms.
No public self-service signup or new publicly advertised demo is implied.

## Verified rehearsal — 15 November 2026

- Local executor: the existing authorized mini PC, in a task-owned bounded job
  (four CPU threads / 4 GiB), with a separate loopback-only, memory-backed
  PostgreSQL fixture. No production database, hosting service or secret was used.
- Normal operator CLI: offline preview, changed-digest rejection, atomic creation,
  repeated apply without duplicates/password replacement and repeated scenario
  population without rewriting later data all passed. The created fixture has
  one company, seven staff, three sites, zero factory sites, two machines,
  four tools, three office memberships, eighteen job tasks and three site files.
- Full regression: 1,304 unit tests in 146 files and 543 integration tests in
  52 files passed, including backup/restore and tenant boundaries. After the
  last seed-label correction the complete crane scenario passed again; lint,
  application and operator-script TypeScript checks passed. Production build
  passed for the final application UI; the later seed/test-only change does
  not enter its runtime bundles.
- Office acceptance uses actual signed admin/worker identities. The director
  sees her own seeded task; finance sees its own task and seven staff workbooks;
  a field worker without membership is denied office access. Road-vehicle
  identity stays plate-based. Asset custody, colleague signatures, returns,
  defect blocking, repair evidence and foreign-record denial passed.
- Visual acceptance: 33 browser cases passed, with no uncaught page errors,
  horizontal overflow or redundant outer scrollbar in the captured views.
  The plan was saved and reloaded, the true content end/footer was reached by
  keyboard at 320×640 and 760×360, and an independent worker PIN session found
  the same server-stored tool by its code through the personal profile. That
  worker was correctly denied the administrative warehouse route. Desktop and
  touch-emulated captures are separate from physical-phone testing. Receipts
  and captures are retained with the task evidence; existing report-only CSP
  and PostgreSQL deprecation warnings were not treated as uncaught page errors.
  Camera/NFC hardware, physical printing and public deployment remain NOT_RUN.

The rehearsal exposed and corrected two fixture identity mismatches: director
office membership now uses the same explicit principal ID as the ordinary office
engine, and saved plan machine labels use the engine's shared plate-aware label
function. No name matching or custom office/dispatch permission engine was added.
Factory-off pages omit empty manufacturing groups and a duplicate site list;
the actual task catalog and add-task action remain available. The opted-in
company's TV workspace has one vertical scroll owner and a natural footer.
German scene labels and stored office titles are selected only for this explicit
presentation profile; existing clients retain their previous defaults.

Native presentation / public showcase / portfolio assessment:
**NO_CONTENT_CHANGE for this local-only rehearsal**. No new public demo URL or
readiness claim is advertised. The portfolio repository sync check passed.
Existing presentation/publication follow-ups remain independent; this feature
branch grants no merge or deployment approval.

# BaumdienstFlow / RediOnFlow - DECISIONS

## 2026-04-30 - Active docs stay short; old notes move to archive

- **Decision**: Keep active docs short and agent-readable. Move obsolete setup/test notes to `docs/archive/` instead of deleting them.
- **Why**: Agents need current truth quickly, while older notes may still be useful as history.
- **Consequences**:
  - `CODEX_INSTRUCTIONS.md` and `AI_RULES.md` define the root reading order for Codex agents.
  - `docs/HANDOFF.md` is current-state only.
  - Detailed history stays in `docs/WORKLOG.md`.
  - Archived files do not override active docs.

## 2026-03-31 — Documentation-first workflow

- **Decision**: Das Repo nutzt ein verpflichtendes `docs/`-Operating-System (ADN/ROADMAP/WORKLOG/HANDOFF/DECISIONS).
- **Why**: Kontinuität über Agent-Sessions, nachvollziehbare Architektur und planbarer Build.
- **Consequences**: Jede Aufgabe aktualisiert ROADMAP/WORKLOG/HANDOFF; größere Änderungen ergänzen DECISIONS/ADN.

## 2026-03-31 — Single source of truth for calculations

- **Decision**: Alle Formeln und Ableitungen leben in einer dedizierten Calculation Engine (`src/lib/calculation/*`), unabhängig von UI.
- **Why**: Verhindert Drift/Duplikate, erleichtert Tests und spätere Erweiterung.
- **Consequences**: UI ruft Engine auf; keine „versteckten“ Berechnungen in Tabellenkomponenten.

## 2026-03-31 — Position-based project structure

- **Decision**: `Project` ist Container, `ProjectPosition` ist kalkulierte Einheit; Kostenzeilen sind typisierte Items (Lohn/Maschine/Material/Fremdleistung).
- **Why**: Spiegelt reale Kalkulationslogik, macht Summen/Breakdowns sauber.
- **Consequences**: Templates, Snapshots, Print Views bauen auf dieser Struktur auf.

## 2026-03-31 — Zod + React Hook Form für zentrale Formulare

- **Decision**: Zentrale Schemas in `src/lib/validation/schemas.ts`; kritische Formulare (Settings, Projekt, Template→Projekt) nutzen **React Hook Form** + **zodResolver**; Server Actions erhalten validierte Objekte.
- **Why**: Weniger Drift zwischen UI und Validierung; klare Fehlermeldungen.
- **Consequences**: `zodResolver` Resolver-Casts können nötig sein (Zod `coerce` + TS-Inferenz).

## 2026-03-31 — Single-company workspace (MVP)

- **Decision**: Die App nutzt **eine** `CompanyProfile`-Instanz pro leerer DB (Auto-Create via `getOrCreateDefaultCompany`).
- **Why**: Schneller interner Betrieb ohne Multi-Tenant-Komplexität.
- **Consequences**: Spätere Multi-Company-Erweiterung bleibt möglich (Schema bleibt company-scoped).

## 2026-03-31 — Money & history handling (cents + snapshots)

- **Decision**: Geldwerte werden als `Int` in **Cent** gespeichert (`*Cents`), Prozentwerte als `Decimal`. Kostenzeilen speichern zusätzlich `NameSnapshot` der Referenz.
- **Why**: Verhindert Rundungs-/Floatfehler; Snapshots halten Projekte stabil, wenn Referenzen später umbenannt/deaktiviert werden.
- **Consequences**: Engine/Formatter arbeiten cent-basiert; UI zeigt formatiert in EUR.

## 2026-04-17 — Route groups: (admin) vs (workzone)

- **Decision**: Admin-UI bleibt unter `/app/*`, aber Dateien liegen unter `src/app/(admin)/app/*`. Der Workzone-Client läuft getrennt unter `/workzone/*` in `src/app/(workzone)/workzone/*`.
- **Why**: Klare Trennung zwischen Office/Administration und Flow-orientierter Worker-Oberfläche, ohne bestehende URLs zu brechen.
- **Consequences**: Gemeinsame Root-Layouts bleiben, aber Workzone bekommt eigenes Layout (Flow, Karten, dark-mode friendly).

## 2026-04-17 — Workzone domain models (Baustelle/TreeItem/WorkLog/ManualTask)

- **Decision**: Workzone bekommt eigene Modelle in Prisma: `Baustelle`, `TreeItem`, `WorkLog`, `ManualTask` (company-scoped über `CompanyProfile`).
- **Why**: Digitale Ausführung/Reporting braucht separate, auditierbare Strukturen, unabhängig von Angebotskalkulation.
- **Consequences**: Worker interagieren via Server Actions; Admin sieht Daten read-only (MVP) und kann Workzone öffnen.

## 2026-04-17 — Auto-lock WorkLogs after midnight (no cron)

- **Decision**: `WorkLog.isLocked` wird automatisch gesetzt, sobald die Workzone geöffnet wird (Server-Side `updateMany` für `date < today 00:00`).
- **Why**: Ohne zusätzliche Infrastruktur (Cron/Queue) bleibt Verhalten deterministisch und funktioniert lokal/offline.
- **Consequences**: Locking ist „event-driven“ (bei Zugriff), nicht zeitgetrieben im Hintergrund; ausreichend für MVP/Local.

## 2026-04-17 — Baustelle templates/types

- **Decision**: `Baustelle.type` (Enum `BaustelleType`) klassifiziert Kern-Arbeitsarten (z. B. Bühne/Kran/Kletter/Bewässerung/Bagger) und wird in Workzone visuell als Wasserzeichen/Badge gezeigt.
- **Why**: Realistische Workflows brauchen schnelle visuelle Erkennung des Einsatztyps.
- **Consequences**: Admin setzt Typ beim Anlegen (`/app/baustellen`); spätere automatische Ableitung aus Dokumenten möglich.

## 2026-04-17 — Workzone v0.1 release

- **Decision**: Release Workzone v0.1 as an integrated MVP inside BaumKalk Pro repository.
- **Why**: Provide a worker-centric Flow UI for on-site tasks, live logs, and mapping to validate field workflows.
- **Consequences**:
  - Files created under `src/app/(workzone)/workzone/*` and admin Baustellen under `src/app/(admin)/app/baustellen/*`.
  - Prisma schema extended; migrations applied and seed updated for stress testing.
  - Server Actions introduced for start/stop working, check tree, create manual tasks.
  - Auto-locking strategy for WorkLogs implemented (event-driven on access).

## 2026-04-17 - TreeItem import upsert + edit audit

- **Decision**: `TreeItem` is unique per `Baustelle` by `(baustelleId, treeId)`. Smart Import reuses an existing Baustelle by import filename and upserts trees instead of creating duplicates.
- **Why**: Field work must not be duplicated or reset when a customer sends an updated Excel/KML package.
- **Consequences**:
  - Re-import creates missing trees and updates only `species`/`diameter` for existing trees.
  - Existing coordinates and completion status are not overwritten by re-import.
  - Manual edits set `TreeItem.isEdited`, `lastEditedBy`, and `lastEditedAt`; the list shows only a discreet marker while details live in the edit dialog.

## 2026-04-17 - HR/Flotte live sessions

- **Decision**: HR workers are modeled as `Worker`, separate from office `User`. Worker login uses first/full name plus unique six-digit `loginCode`; login alone never starts working time.
- **Why**: Field crews need a lightweight tablet/mobile login and live status without mixing operational HR identities with office/admin users.
- **Consequences**:
  - `WorkSession` is the source of truth for live status and work hours (`isLive`, `startTime`, `endTime`, `breakMinutes`, `totalHours`).
  - Workzone header renders active workers from `WorkSession.isLive`.
  - Existing `Machine` is extended with fleet fields (`nickname`, `model`, `targe`, years, function, required license) and practical inspection fields from the company Excel (`HU`, `SP`, `UVV` plus statuses) to avoid parallel machine catalogs.
  - `/app/admin` is the combined HR/Flotte admin surface; `/app/machines` remains compatible with the calculation module.

## 2026-04-18 - Workzone identity uses Worker, not office User

- **Decision**: Workzone Baustelle actions use the logged-in `Worker` from the `bk_worker_id` cookie. Office `User` remains for admin/legacy relations only.
- **Why**: Field workflows should not require selecting "admin/worker" on every Baustelle; the app should know who is working.
- **Consequences**:
  - Baustelle detail is read-only/admin-like when no worker is logged in.
  - Tree checks, tree edits, manual tasks and live sessions are attributed to `Worker`.
  - `WorkSession.baustelleId` records which Baustelle a worker is live on.
  - Temporary/external workers can be created from a Baustelle and get a live `WorkSession` immediately.
  - A temporary worker has no login code by default; when admin assigns a six-digit `loginCode`, they can log in like a normal worker.
  - Worker metadata now includes `birthDate`, `startedAtCompany`, `level`, and `isTemporary` for later ranking/badge UX.

## 2026-04-18 - Worker reports, pause presets and availability

- **Decision**: Worker hours and daily/monthly reports are derived from operational data, not manually authored spreadsheets.
- **Why**: Reports must reflect what actually happened in Workzone: sessions, completed trees and extra Baustelle tasks.
- **Consequences**:
  - `WorkReportNote` stores only worker notes per day/month; the activity list remains read-only and traceable.
  - STOP PUNA suggests break time automatically: 0 minutes for shifts up to 4 hours, 30 minutes for shifts over 4 hours.
  - Break editing is limited to the presets 0, 15, 30 and 60 minutes.
  - `Worker.availability` controls whether a worker can start a new live session; sick/vacation/unavailable workers are visible in admin/header colors and blocked from starting work.
  - Admin worker detail pages expose printable daily and monthly report views for each worker.

## 2026-04-18 - Printable Tagesbericht vs Stundenzettel split

- **Decision**: Tagesbericht and Stundenzettel are separate printable documents with different information density.
- **Why**: A daily work report should explain what was done on each Baustelle; the monthly timesheet should explain when and where the worker worked.
- **Consequences**:
  - Tagesbericht excludes session/hour/pause lists and groups only completed trees plus manual tasks by Baustelle.
  - Each Baustelle section prints name, Standort/address fallback and simple tables for tasks and trees.
  - Tree rows print ID, species, Durchmesser/StU, Kronenbreite, height and performed action; missing fields render as `-` until import/schema supports them directly.
  - Stundenzettel prints one monthly sheet with one row per calendar day, including start, end, break, Baustelle/location and daily total.
  - App shell branding/navigation/footer is hidden in print so browser PDF output is a document, not an app screenshot.

## 2026-04-18 - Separate Admin and Worker Sessions

- **Decision**: Office/Admin identity uses `User(role=ADMIN)` and a dedicated `bk_admin_id` cookie; worker identity stays on `Worker` and `bk_worker_id`.
- **Why**: A logged-in worker must not become an admin simply by clicking or typing an `/app/*` URL.
- **Consequences**:
  - `/app/*` is guarded by the Admin layout and redirects unauthenticated users to `/admin-login`.
  - `/admin-login` provides a lightweight local MVP login with email plus six-digit code.
  - The current default local test admins are `redi@baumdienst.flow`, `oli@baumdienst.flow`, and `lucy@baumdienst.flow`.
  - Workzone header shows the Admin link only when an admin session exists.
  - When an admin is logged in, the worker initials in the Workzone header open the selected worker's Admin profile.
  - Admin report pages can save a note, while generated Tagesbericht/Stundenzettel data remains read-only.

## 2026-04-25 - Admin login remains intentionally lightweight for local testing

- **Decision**: Keep admin authentication as a simple local MVP flow for tests/demos.
- **Why**: Current project use is internal/local; fast bootstrap is more valuable right now than a full admin credential management system.
- **Consequences**:
  - `/admin-login` ensures the default admins exist on access/login.
  - Admin login uses `email + 6-digit code`.
  - `User.passwordHash` currently behaves as a plain login code in this MVP.
  - `Redi` is the designated primary local test admin.
  - Only the primary test admin may create or edit other local test admins, via `/app/profile`.
  - No schema change or production-grade credential flow was added for this.

## 2026-04-25 - Own admin profile entry stays separate from the assistant logo

- **Decision**: The logged-in admin's own profile entry should live on the fixed `Baumdienst Flow26` badge in the root layout, not on the shared assistant/company logo.
- **Why**: The company/assistant logo is already a stable assistant entry point across Workzone/Admin. Mixing own-profile behavior into that logo would break the shared-shell mental model and create UI confusion.
- **Consequences**:
  - Clicking the top-right fixed `Baumdienst Flow26` badge opens `/app/profile` for logged-in admins.
  - The shared top-shell company/assistant logo keeps opening the assistant only.
  - The compact admin profile button list in the header shows only the normal admins (`Oli`, `Lucy`); the primary admin (`Redi`) is intentionally omitted from that list.

## 2026-04-25 - Admin assistant uses dashboard snapshot as KPI source

- **Decision**: Dashboard-style KPI/statistics questions for admins should use the same cached snapshot layer as `/app/dashboard`.
- **Why**: This keeps assistant answers aligned with the visible panel, avoids duplicate aggregation logic, and reduces hallucination risk.
- **Consequences**:
  - `adminGetDashboardSnapshot` exposes the read-only dashboard snapshot to the admin assistant.
- The assistant prompt explicitly prioritizes snapshot data for dashboard/panel/KPI questions.
- Answers should stay human and concise, but must remain tied to real snapshot values only.

## 2026-04-26 - Tagesplan keeps one active version per day and archives previous saves

- **Decision**: `DailyWorkPlan` remains unique per `companyProfileId + planDate`; repeated saves on the same day create archived snapshots of the previous saved state instead of multiple parallel active plans.
- **Why**: Workers/Admins need one clear current plan for the day, but operations still need a recoverable history when the plan changes later.
- **Consequences**:
  - The current day plan remains simple and unambiguous for Workzone, planner actions, and assistant lookups.
  - Previous saved states are stored as `DailyWorkPlanSnapshot` + `DailyWorkPlanSnapshotRow`.
  - The Workzone calendar can show `Aktuell` plus earlier `Version n` entries for the same date.
  - We intentionally avoid multiple simultaneously active day plans, because that would complicate planner, calendar, and assistant semantics.

## 2026-04-18 - Report Notes as Chat Thread

- **Decision**: Report notes behave like a small communication thread between Worker and Admin.
- **Why**: A single textarea is too weak for field communication; notes should show who wrote what and preserve context.
- **Consequences**:
  - `WorkReportNote.note` stores a JSON message list inside the existing field, so no new migration is required.
  - Legacy plain-text notes are still parsed and shown as a single fallback message.
  - Worker/Admin can append messages from a two-line prompt; generated report activity remains read-only.
  - Print views render the thread as readable `Author: message` lines instead of raw JSON.

## 2026-04-18 - Shared Worker Profile and Assets

- **Decision**: Worker self-profile and Admin worker profile use the same profile view component.
- **Why**: Admin should see the worker profile exactly like the worker, with the same operational context and fewer duplicated UIs.
- **Consequences**:
  - `WorkerProfileView` is shared between `/workzone/profile` and `/app/admin/workers/[workerId]`.
  - Admin can access the same START/STOP controls, profile details, documents, tickets and reports for a worker.
  - Worker now stores `profileImageUrl` and `documents` for profile photo plus contracts/certificates/school/license files.
  - Uploads are stored under `public/uploads/workers/[workerId]` and linked from the profile document list.
  - File uploads are intentionally small for now (max 3 MB) to keep local operation lightweight.

## 2026-04-18 - Worker Documents and Inventory Confirmation

- **Decision**: Worker documents stay lightweight as `Worker.documents` JSON metadata, while physical handover items use a dedicated `WorkerAssetItem` table.
- **Why**: PDFs/photos are simple profile attachments, but clothes/equipment need operational ownership and two-sided confirmation.
- **Consequences**:
  - Documents can be uploaded by click/drag, opened from compact profile buttons and removed from the profile after confirmation in the browser.
  - `Worker.emailAccount` stores the worker email/account row shown in the profile contact card.
  - `WorkerAssetItem.kind` separates `CLOTHING` from `EQUIPMENT`.
  - If a worker adds an item, it is `PENDING_ADMIN_CONFIRMATION` until admin confirms.
  - If admin adds an item, it is `PENDING_WORKER_CONFIRMATION` until worker confirms.
  - Delete requests follow the same two-sided handshake before the item becomes `DELETED`.
  - The handover date is the creation date (`handedOverAt`) unless a later import/edit feature explicitly changes it.

## 2026-04-18 - Company Inventory as Master Data

- **Decision**: Tools, clothes and Baustelle equipment are company master data in `CompanyInventoryItem`; worker profile items reference this catalog when possible.
- **Why**: The company needs one clean inventory base with stable IDs, while worker profiles should show where items move and who confirmed handover/deletion.
- **Consequences**:
  - Admin HR/Flotte now has three inventory tables: `WORK_TOOL`, `CLOTHING`, `SITE_EQUIPMENT`.
  - `CompanyInventoryItem.itemCode` is unique inside the company and is the practical ID printed/used in the field.
  - Worker handover rows can store `companyInventoryItemId`, plus a snapshot of name/code/note for readable history.
  - Catalog deletion is soft (`isActive=false`) so old handover history remains traceable.
  - Worker profile inventory remains hidden behind two buttons until the user opens `Rrobat` or `Pajisjet`.

## 2026-04-18 - Workzone Fleet Side Rail

- **Decision**: Workzone shows machines as a persistent right-side rail with circular photo/status buttons.
- **Why**: Field workers need quick machine context without leaving the Baustelle/profile flow, while admin needs one fast way to mark a machine as blocked.
- **Consequences**:
  - `src/app/(workzone)/workzone/machine-sidebar.tsx` renders machine circles and the Flow detail card.
  - Orange dots indicate existing machine notes (`Machine.notes`).
  - Red/`GESPERRT` indicates `Machine.isActive=false`; workers see a warning, admins can set this from the card.
  - Machine notes are appended with author and timestamp through `addMachineNoteAction`.
  - Admin blocking uses `blockMachineAction` and revalidates Workzone/Admin machine views.

## 2026-04-18 - Baustelle time prompts and system auto-close

- **Decision**: Baustelle live work uses assisted time prompts instead of blind "now" timestamps.
- **Why**: Workers often start around 07:00 and may forget to press START/STOP exactly on time; reports should stay realistic without hidden manual edits.
- **Consequences**:
  - Clicking `Puno aty tani` opens a choice between current time and an editable 07:00 default.
  - Closing after 16:30 opens a choice between current time and an editable 16:30 default.
  - Server Actions accept the selected `startTime`/`endTime` and calculate totals from the persisted values.
  - The worker profile is the primary place for choosing a custom START time.
  - Baustelle `Puno aty tani` asks for a time only when the worker has no live session; if a live session exists, it links/switches it to the Baustelle without another prompt.
  - Sessions stopped before 60 seconds are treated as accidental clicks and deleted instead of appearing in hours/Tagesberichte.
  - Forgotten early day sessions are auto-closed only after noon on the following day, at 16:00 with 30 min pause.
  - Night/late shifts are not auto-closed by this rule because starts outside the day-window are ignored.
  - Auto-closed sessions set `WorkSession.closedBySystem=true` and store `systemNote`; Tagesberichte show this marker.

## 2026-04-18 - RediON / Flow branding shell

- **Decision**: Global branding is centralized in `src/lib/branding.ts` and rendered through shared components.
- **Why**: The same platform may run for Baumdienst, AutoService or another client category while the `Flow` platform mark stays stable.
- **Consequences**:
  - `appName` controls the category label; `appSuffix` remains `Flow`.
  - Header uses `public/branding/logoholz.png`, category text, green `Flow`, and the red Alfa-style `®` mark.
  - `RediON` footer is global, minimal and low-opacity.
  - Primary UI accent is green from the logo; dark mode was shifted from blue/slate to a lighter neutral grey base.

## 2026-04-18 - Safe local Docker DB lifecycle

- **Decision**: Local DB helper scripts are safe-by-default (start/stop without implicit destructive remove).
- **Why**: Frequent local restarts must not silently switch to empty volumes or wipe active working data.
- **Consequences**:
  - `db-start` prefers existing/running container and supports explicit reset only via dedicated flag.
  - `db-stop` stops container by default; removal is explicit.
  - Named volume usage is documented in README for predictable persistence.

## 2026-04-18 - Machine caution channel separated from technical notes

- **Decision**: Workzone machine indicator is driven by a dedicated `Kujdes` prompt channel, not by full machine technical note history (`HU/SP/UVV` and free notes).
- **Why**: Operators need a clear binary warning signal without noise from long historical maintenance text.
- **Consequences**:
  - Indicator color logic: green when empty, orange when caution text has meaningful content, red when machine is blocked.
  - Workzone machine note editing is removed; notes are read-only in Workzone and intended for admin management.
  - Caution entry in Workzone is autosaved and shown as an operational warning field.

## 2026-04-18 - Admin parity in Baustelle operations with separate reporting attribution

- **Decision**: Admin can execute operational Baustelle actions (tree check/edit, manual tasks, external helper creation), but attribution stays role-specific.
- **Why**: Office/admin must be able to intervene live in the field flow without corrupting worker accountability in worker reports.
- **Consequences**:
  - Worker actions still map to worker report sources.
  - Admin actions map to admin user attribution and are visible in a dedicated admin daily report.
  - Shared UI keeps operational parity while preserving audit separation.

## 2026-04-19 - Admin daily planner as non-blocking orchestration layer

- **Decision**: Introduce a dedicated admin day planner (`/workzone/plan`) with drag/drop columns and calendar date switching.
- **Why**: The team needs a visual way to assign workers/machines into work groups before execution, without forcing operational lock-in.
- **Consequences**:
  - Planner persists per day (`DailyWorkPlan`) with sortable columns and assignment rows.
  - Worker and machine assignments are modeled separately with snapshots for robust rendering/history.
  - Workzone main cards can display planner hints (shadow text) but core execution remains driven by live sessions and actual actions.
  - Admin can add template-empty planning columns to stage new Baustellen ideas before they become real executed work.

## 2026-04-19 - Planner anchored to real Baustellen only

- **Decision**: Remove free/manual planner columns and use only existing Workzone Baustellen as planning drop-zones.
- **Why**: Field planning must stay aligned with real execution objects and avoid drift between "planned name" and actual Baustelle.
- **Consequences**:
  - `+ Kolone e re` is removed.
  - Planner board shows one planning zone per real Baustelle.
  - Worker/machine assignment actions resolve by `baustelleId` and keep uniqueness per day.

## 2026-04-19 - Workzone Calendar as shared read-only popup

- **Decision**: `Calendar` on Workzone is available for admin and worker, but remains read-only.
- **Why**: Teams in the field need fast visibility into the day plan without exposing edit controls.
- **Consequences**:
  - Admin edits continue only via `/workzone/plan`.
  - Worker can inspect planned groups by date directly from Workzone homepage.

## 2026-04-19 - Local day normalization for planner dates

- **Decision**: Stop using UTC `toISOString().slice(0,10)` for planner lookup keys; use local date composition and local start-of-day parsing.
- **Why**: UTC conversion created off-by-one-day mismatches between selected calendar date and stored plan rows.
- **Consequences**:
  - Planner and calendar table now remain coherent by selected local day.
  - Date parsing is explicit and validated (`YYYY-MM-DD` -> local `Date(year, month-1, day)`).

## 2026-04-19 - Baustelle documentation is an operational document module

- **Decision**: Treat `Dokumentation` on Baustelle detail as a full document module (modal with upload/open/print/remove) available to both worker and admin.
- **Why**: Field teams must present Baustelle control documents during inspections directly from Workzone, without switching to admin-only flows.
- **Consequences**:
  - Workzone actions now include Baustelle document upload and delete operations with role/company checks.
  - New uploads are stored as public file URLs under `public/uploads/baustellen/[baustelleId]/`.
  - Existing legacy document name entries remain visible for compatibility, even when not directly openable.

## 2026-04-19 - Mission Map geocoding fallback and compact footer branding

- **Decision**: In Workzone map mode, resolve missing Baustelle GPS coordinates from `standortAddress` at runtime and use the result for map visibility/zoom state.
- **Why**: Newly created Baustellen may have address data but no stored GPS coordinates; teams still need to see and navigate those projects in map mode.
- **Consequences**:
  - `workzone-mission-control` now performs client-side geocoding fallback and marks such items as map-visible when coordinates resolve.
  - Geocoding failures are silent fallback (`No GPS`) and do not block UI.
  - Footer branding keeps a compact RediON style and uses the concise slogan `Upgrade humans. Not replace them...`.

## 2026-04-19 - Baustelle documentation includes native sending path

- **Decision**: Add a direct `Senden` action per Baustelle document in Workzone, with Web Share API first and email fallback.
- **Why**: During inspections, crews need to quickly forward documents from tablet/phone without downloading and manually attaching files.
- **Consequences**:
  - Both worker and admin can send documents from the same modal workflow.
  - Mobile devices can trigger native share dialogs; desktop environments open a prefilled email composer with document link.

## 2026-04-19 - Replace Baustelle document text prompts with real attachments

- **Decision**: Use file uploads as the default and primary way to attach Baustelle documentation, including during Admin Baustelle creation.
- **Why**: Name-only prompts create non-actionable entries (`Nur Name`) without open/print/send functionality and confuse field usage.
- **Consequences**:
  - Admin `Neue Baustelle` flow now accepts real files directly and stores URLs in `Baustelle.documents`.
  - Workzone documentation modal and admin create flow share the same attachment model and terminology (`Dokument hinzufügen`).
  - Legacy name-only rows remain readable for compatibility, but operational workflows should use uploaded files.

## 2026-04-20 - Safety equipment is tracked as stock + movements

- **Decision**: Introduce dedicated safety equipment tracking with company-scoped stock catalog (`CompanyInventoryCatalog`) and auditable movement ledger (`InventoryMovement`).
- **Why**: Parking signs, plates, and fences are movable operational assets and must be tracked by quantity, actor, and site to prevent loss and ambiguity.
- **Consequences**:
  - Baustellen store live on-site safety counts in `activeEquipmentStatus` JSON for fast status indicators and UI rendering.
  - Deploy operations decrement company stock; collect operations increment it back; both write movement history rows.
  - Workzone keeps completed Baustellen visible when safety assets remain on-site and marks them as pending collection.

## 2026-04-24 - Barcode worker inventory uses a separate ledger

- **Decision**: Add `InventoryAssetMovement` for barcode-driven worker inventory instead of overloading the existing `InventoryMovement`.
- **Why**: `InventoryMovement` already serves Baustelle safety stock (`SIGN`, `PLATE`, `FENCE`). Mixing worker item assignment with site stock movements would blur reporting and break established logic.
- **Consequences**:
  - Worker item audit rows are item-level and use `TAKE`, `RETURN`, `CREATE_PRIVATE`.
  - `CompanyInventoryItem.barcode` is globally unique.
  - Private items are allowed without a company catalog record, so `InventoryAssetMovement.itemId` remains optional.
  - Admin inventory printing/generation can evolve independently from Baustelle safety stock tracking.

## 2026-04-24 - Admin scan registers stock, worker scan assigns stock

- **Decision**: The admin scan flow is the intake path for warehouse stock; the worker scan flow is the checkout path from warehouse to worker.
- **Why**: The same barcode should not create different meanings depending on UI surface. Warehouse intake and worker assignment are two different business actions.
- **Consequences**:
  - Admin inventory page is scan-first and creates one `CompanyInventoryItem` per scanned physical article.
  - `CompanyInventoryItem` is treated as a single physical unit, not an aggregate quantity row.
  - Worker scan finds the existing warehouse unit by barcode and assigns it if and only if it is not already assigned.
  - Private fallback remains worker-only for unknown barcodes.

## 2026-04-20 - Identity-aware Team Assistant is read-only + gated

- **Decision**: Implement an identity-aware Team Assistant that can impersonate addressed team members, but remains **strictly read-only** and **permission-gated**.
- **Why**: Teams need a fast “ask the right person” interface with live operational context, without exposing private data or enabling accidental writes.
- **Consequences**:
  - Assistant reads requester identity from cookies: `bk_admin_id` (Admin) and `bk_worker_id` (Worker).
  - Admin persona responses are available **only** when the requester is also Admin.
  - Worker persona responses can expose live operational data (live Baustelle, plan machine) while keeping private details restricted unless requester is Admin.
  - Persona style/tone is driven by `aiPersonalityNote` on `User` and `Worker`.
  - Language preference is stored per profile (`preferredLanguage`) and used for responses (DE/SQ).

## 2026-04-20 - AI SDK multi-step tool execution (`stopWhen`)

- **Decision**: Configure `streamText` with `stopWhen: stepCountIs(14)` instead of relying on the SDK default (`stepCountIs(1)`).
- **Why**: The default stops after one model step, which prevents reliable “tool call → tool result → final natural language answer” chains.
- **Consequences**: Slightly higher token/tool budgets per request; prompts must still discourage unnecessary tool spam.

## 2026-04-20 - Admin assistant tools for company-wide read-only analytics

- **Decision**: Add dedicated **admin-only** Prisma-backed tools for aggregates (live workforce, hours sums/rankings, license text search, Baustellen overview, projects, manual tasks) in `src/lib/assistant/admin-tools.ts`.
- **Why**: Admins need answers across all workers and sites; workers must not receive team-wide HR or project internals through the assistant.
- **Consequences**:
  - Worker-facing tools remain scoped (self + public Workzone directory + operational peer queries where allowed).
  - Any new sensitive aggregate must be implemented as an explicit tool with an admin gate (return `{ ok: false }` for non-admins).

## 2026-04-20 - Single source of truth for assistant behavior documentation

- **Decision**: Maintain `docs/AI_ASSISTANT.md` as the canonical description of assistant architecture, tool inventory, privacy boundaries, and future improvements.
- **Why**: The assistant spans API routes, Prisma, and prompts; a dedicated doc reduces drift and speeds up safe iteration.
- **Consequences**: `HANDOFF.md` references `docs/AI_ASSISTANT.md`; larger behavioral changes should update that file.

## 2026-04-23 - One codebase with demo and dedicated production deployment modes

- **Status**: Superseded by `2026-04-30 - SaaS rollout stays fact-driven and mode-first`.
- **Decision**: BaumKalk Pro remains one codebase with two deployment modes: Railway + Supabase for demo/test/portfolio usage, and Docker + dedicated server/database for each real client production deployment.
- **Why**: The product should avoid duplicated app versions while still supporting fast presentations, realistic company testing, and stable client-owned production operation.
- **Consequences**:
  - Deployment mode differences belong in environment variables, database URLs, seed/reset tooling, runbooks, and deployment files.
  - Demo mode must be easy to reset, reseed, and adapt for a specific company presentation.
  - Production mode must be isolated per client, stable, backup-aware, and intentionally deployed.
  - Strategic deployment details live in `docs/DEPLOYMENT.md`; future implementation work should update it instead of scattering deployment notes.

## 2026-04-25 - First external rollout targets baumdienstflow.info in demo mode

- **Status**: Archived rollout note. Active direction is dedicated clients plus future RediOnFlow SaaS.
- **Decision**: The first external customer-facing rollout should be the demo/test mode on `baumdienstflow.info`, hosted on Railway with Supabase Postgres.
- **Why**: This gives one realistic external test environment quickly, while keeping the later dedicated German-client deployment path intact and separate at the infrastructure layer.
- **Consequences**:
  - `APP_ENV=demo` becomes the intended mode for that rollout.
  - The repository documents one shared env shape for local, demo, and dedicated production.
  - The dedicated client path remains `Docker + dedicated server/VPS + dedicated Postgres`, with no code fork.
  - Deployment preparation should stay documentation/env/runbook-first before adding infrastructure-specific files.

## 2026-04-26 - Destructive reset scripts are deployment-gated

- **Decision**: Demo/local reset scripts must be guarded by deployment environment flags.
- **Why**: The same repo now serves local development, external demo/test usage, and future dedicated client production. Old unguarded reset scripts are too risky once a real external environment exists.
- **Consequences**:
  - `APP_ENV=production` blocks destructive reset scripts.
  - `APP_ENV=demo` requires explicit `DEMO_MODE=true` and `DEMO_RESET_ALLOWED=true` before reset scripts can run.
  - `local` remains usable for day-to-day development resets.

## 2026-04-26 - Public domain entry is an informational landing page, not Workzone

- **Decision**: The public domain root (`/`) should act as an informational landing page for Baumdienst Flow, while operational entry points stay separate and less exposed.
- **Why**: Workzone, admin, worker lists, Baustellen, and fleet views should not be the first public-facing surface on the live domain. The safer and more professional pattern is a public presentation page plus a discreet internal access path.
- **Consequences**:
  - `/` becomes the public marketing/information page.
  - Internal access is routed through a discreet `/zugang` entry.
  - `/admin-login` and `/workzone/login` stay functional, but are marked `noindex` and are no longer intended as the public front door.
  - No operational route, auth flow, or business logic is changed by this presentation split.

## 2026-04-26 - Test-mode logins get lightweight throttling without schema changes

- **Decision**: Keep the existing simple worker/admin login flows, but add a lightweight in-memory attempt guard.
- **Why**: The current auth is intentionally MVP/test-oriented, but the public demo domain still needs a basic shield against repeated guessing or noisy login probing.
- **Consequences**:
  - Admin login and worker login now temporarily block repeated failed attempts per client IP.
  - No Prisma schema or persistent auth tables were introduced.
  - The guard is intentionally lightweight and instance-local, which is acceptable for the current Railway test mode.
  - Successful login clears the local attempt bucket.

## 2026-04-23 - Shared Flow top shell across Workzone and Admin

- **Decision**: The top Flow shell is shared across `/workzone/*` and `/app/*`: one stable header with the company/AI logo trigger, Home, Panel, worker strip, and admin profile buttons.
- **Why**: Admin should not mentally switch UI chrome when moving between Workzone, profile, and panel. The assistant must open from one canonical place only.
- **Consequences**:
  - Assistant access lives behind one AI-badged logo trigger in the shared top bar.
  - Admin layout may still keep deeper navigation (for example sidebar links), but the top shell must stay consistent.
  - Header drift between Workzone and Admin should be fixed by changing the shared shell component, not by creating route-specific logo variants.

## 2026-04-23 - Admin panel keeps the Flow shell and fleet rail

## 2026-04-30 - SaaS rollout stays fact-driven and mode-first

- **Decision**: Build the SaaS platform in sequence: current BaumdienstFlow stability first, SaaS structure second, BaumdienstFlow SaaS parity third, BauFlow fourth, PersonalFlow fifth.
- **Why**: BaumdienstFlow already exists as the real-client product and must remain the reference implementation. BauFlow and PersonalFlow should be derived only after the shared SaaS structure and mode system are proven.
- **Consequences**:
  - No separate apps are created for BaumdienstFlow, BauFlow, or PersonalFlow.
  - Product differences must come from `company.mode`, `modeConfig`, feature flags, navigation visibility, terminology, and UI simplification.
  - BauFlow reuses the same company/work/task logic but removes or replaces tree-specific behavior.
  - PersonalFlow comes later as a simplified mode derived from BauFlow, not as a new product fork.
  - Every meaningful SaaS step must update repo notes so the project can be resumed from documentation, not memory.

- **Decision**: Admin pages reuse the same Flow top shell and the same right-side fleet rail as Workzone.
- **Why**: Admin should keep machine context and the same navigation rhythm while moving between operational and office views.
- **Consequences**:
  - Fleet sidebar data is loaded through a shared helper instead of duplicating machine/cone aggregation logic in multiple layouts.
  - The admin left navigation should feel like floating action buttons, not a heavy boxed side panel.
  - Assistant panel z-index must stay above the Workzone announcement editor and similar header popovers.

## 2026-04-24 - Language switching is worker-first and scope-limited

- **Decision**: Roll out language switching only in the shared shell plus worker-facing Workzone/Profile UI first. Admin, report, and print surfaces stay untouched until a later explicit batch.
- **Why**: The safest path is to prove the language resolver, client context, and top-bar switcher in the operational worker flow before expanding scope across the whole app.
- **Consequences**:
  - `src/app/layout.tsx` provides one `LanguageProvider` for the app shell, and request language is resolved in `src/lib/i18n/server.ts`.
  - Core Workzone/Profile client components now use `t("...", currentLang)` for visible controls and labels.
  - Existing profile language fields are reused instead of introducing a new schema change.
  - The rest of the app remains stable but is not yet fully live-switch aware.

## 2026-04-24 - Worker language rollout continues in small UI-only batches

- **Decision**: Expand worker language support in narrow Workzone/Profile batches, prioritizing visible controls, summaries, and status labels before deeper forms or admin/report surfaces.
- **Why**: This keeps the system predictable and easy to verify while still making the worker-facing app feel progressively complete in the user's own language.
- **Consequences**:
  - Server-rendered worker pages may resolve `currentLang` directly and pass it into `t(...)` without changing routing or backend behavior.
  - Language preference forms continue to reuse the existing profile fields rather than introducing a separate language subsystem.
  - Remaining hardcoded worker UI should be migrated file by file, with `tsc` and targeted `eslint` checks after each batch.
# 2026-04-24

- Tree completion in Workzone should not fire immediately on tap.
- We use a lightweight client confirmation step for both:
  - marking a tree as `Fertig`
  - undoing a completed tree
- This keeps the interaction safer on mobile/touch usage without changing the underlying tree status logic.

## 2026-04-24 - Workzone confirmations and quick inputs stay inside the app shell

- **Decision**: Replace browser-native `window.confirm` / `window.prompt` in worker-facing Workzone flows with one lightweight shared in-app dialog.
- **Why**: Browser popups feel detached from the product UI, vary by platform, and are easier to mis-tap on mobile/touch usage.
- **Consequences**:
  - Tree completion/undo, safety quantity entry, machine blocking, and profile asset/inventory deletion now use the same dialog pattern.
  - Future worker-facing confirmations or quick numeric inputs should reuse `src/components/ui/simple-dialog.tsx` instead of reintroducing browser prompts.

## 2026-04-24 - Baustelle note creator and finisher are separate concerns

- **Decision**: Keep the Baustelle note creator as the visible origin in Baustelle UI, but attribute the completed task in daily reporting to the worker who marks it finished.
- **Why**: Operations need to know who left the note on site, while reports should reflect who actually carried out the work.
- **Consequences**:
  - `ManualTask` stores completion audit fields and uses them in reporting.
  - Baustelle cards/indicators stay concise (`Shenim: ...`) without changing creator semantics.
  - Migration `20260424133000_add_manual_task_resolution_audit` is required for the full reporting behavior.

## 2026-04-24 - Worker strip fallback favors surname over mixed initials

- **Decision**: When a worker has no profile image, show the surname inside the circular avatar fallback.
- **Why**: The top strip is visually tighter and easier to scan when fallback labels are short and consistent.
- **Consequences**:
  - Workers without photos no longer show the previous first-name/initial mix in the top strip.
  - This is a display-only change; it does not alter worker names, sorting, or profile data.

## 2026-04-24 - Worker assistant stays separate from admin assistant

- **Decision**: Add a dedicated worker-only `AI Hilfer` entry point in `/workzone` instead of reusing the admin assistant behavior.
- **Why**: Worker guidance needs a smaller, safer surface focused only on visible Workzone features and worker permissions.
- **Consequences**:
  - Worker assistant uses worker-only docs as its context source.
  - It stays read-only and must not expose admin or hidden company functionality.
  - Admin assistant remains a separate path with its own scope and persistence behavior.

## 2026-04-24 - Worker assistant history is ephemeral across refresh

- **Decision**: Do not persist worker assistant chat across page refreshes.
- **Why**: This keeps the helper lightweight, reduces privacy/storage concerns, and avoids unnecessary system complexity for short-lived UI guidance.
- **Consequences**:
  - Worker assistant chat clears on refresh.
  - The panel includes a manual clear action for the current session.
  - No server-side learning or storage is introduced from worker helper chats.

## 2026-04-24 - Vacation decision badge is latest-decision only

- **Decision**: The worker vacation `!` badge should represent only the latest reviewed vacation decision and disappear once the worker opens their own profile.
- **Why**: Workers should get one clear notification per decision, not repeated alerts from older approved/rejected requests or stale local browser state.
- **Consequences**:
  - Badge logic compares the latest reviewed decision timestamp against the latest seen timestamp in browser storage.
  - Entering `/workzone/profile` marks the latest reviewed decision as seen.
  - Legacy browser keys are migrated/cleared to avoid old test state recreating the badge.

## 2026-04-24 - Requested safety material can be cleared before deployment

- **Decision**: A requested Baustelle safety/material item can be removed directly while quantity is still zero.
- **Why**: Workers should not be forced into a fake deploy/collect cycle just to cancel a request.
- **Consequences**:
  - Main Baustelle safety panel exposes a direct `remove request` action for request-only rows.
  - Tree-level safety picker also allows removing a request before anything is placed on site.
  - Existing quantity/deploy/collect behavior remains unchanged once material is actually on site.

## 2026-04-24 - Warehouse barcode is immutable after first assignment

- **Decision**: A warehouse article barcode may be set only once, either by admin scan intake or by one-time generation for an older manual row without barcode.
- **Why**: The barcode is the physical identity of the item in stock. Regenerating or editing it later would break sticker trust and audit clarity.
- **Consequences**:
  - Admin UI renders existing barcodes as read-only text, not as editable inputs.
  - `generateAdminInventoryBarcodeAction` refuses regeneration when an item already has a barcode.
  - `updateAdminInventoryItemAction` ignores later barcode edits once the item already has one.
  - Worker assignment UX switches to the matching inventory section immediately after a successful take, so the moved item is visible without extra clicks.

## 2026-04-24 - Clothing inventory tracks sizes at stock and worker level

- **Decision**: Clothing items carry an explicit `sizeLabel`, and worker profiles store personal clothing/shoe sizes separately.
- **Why**: The company must know both which sizes are physically in stock and which sizes a worker actually needs before assigning clothes.
- **Consequences**:
  - `CompanyInventoryItem.sizeLabel` records the warehouse size per clothing unit.
  - `WorkerAssetItem.sizeLabel` snapshots that size on assignment, so worker inventory stays readable even later.
  - Worker profiles now store `clothingTopSize`, `clothingBottomSize`, and `shoeSize`.
  - The admin clothing column provides a size filter whose counts reflect only currently free stock.

## 2026-04-25 - Admin dashboard uses a cached read-only operational snapshot

- **Decision**: `/app/dashboard` reads from a dedicated snapshot helper (`src/lib/dashboard/dashboard-snapshot.ts`) instead of embedding operational aggregation logic directly in the page.
- **Why**: The dashboard should become visually useful for operations without changing system behavior, touching Workzone internals, or adding unnecessary DB load.
- **Consequences**:
  - Snapshot data is derived only from existing tables (`WorkSession`, `Worker`, `Baustelle`, `TreeItem`, `Machine`).
  - Cache lifetime is 60 seconds via Next cache; manual refresh invalidates only the dashboard snapshot tag.
  - The page remains a read-only visual layer with simple cards/charts and no realtime subscription.

## 2026-04-28 - Public demo is a separate read-only product surface

- **Decision**: Expose Workzone/Dashboard/product-story pages through a dedicated `/demo` route family instead of relaxing the real admin or worker application.
- **Why**: The product needs a live-looking public preview, but the operational app must keep its existing auth, permissions, and action boundaries untouched.
- **Consequences**:
  - Demo routes reuse existing data reads where practical, but do not reuse write-capable flows blindly.
  - Real admin/worker routes, guards, and server actions remain the source of truth for actual operations.
  - Demo can preserve visual interaction where useful for storytelling, such as opening details or dragging Baustelle cards, as long as those interactions remain presentation-only.

## 2026-04-28 - Global footer branding is fixed to the shorter RediON signature

- **Decision**: Standardize the global footer on the two-line brand signature `RediON` and `Upgrade humans. Not replace them.`
- **Why**: The footer should act as a clean ownership mark across the product without extra wording or decorative punctuation.
- **Consequences**:
  - The previous `Produced by` phrasing is removed.
  - The previous trailing ellipsis is removed.
  - Admin, Workzone, demo, and landing pages all inherit the same footer copy through `RediOnFooter`.

## 2026-04-28 - Customer-facing live view uses protected display access, not public demo

- **Decision**: Treat `/demo/*` as website-only storytelling, and implement the real customer-facing live screen feature as a separate protected display session.
- **Why**: Customers may want a passive screen for dashboard/workzone live, but they should not have to expose their operational Workzone publicly or receive accidental admin capabilities.
- **Consequences**:
  - A dedicated display login/session now lives outside admin and worker auth.
  - Display users can open only `/display/workzone` and `/display/dashboard`.
  - Display Workzone remains view-only, with no internal Baustelle navigation or edit affordances.
  - The landing page now positions `Display View` as the product innovation instead of presenting `Demo Mode` as a core app feature.

## 2026-04-30 - Scan identity is hidden technical matching data

- **Decision**: QR/NFC tree scans store the raw scan value as `scanCode` and a normalized `scanIdentity` inside `TreeItem.notes` when an extra tree is created.
- **Why**: A scanned tag/code may contain a unique value that is not the visible Baum-ID. The app must recognize the same physical tag later even if the worker edits the tree name or visible ID.
- **Consequences**:
  - The UI does not expose the raw scan text as a normal note field.
  - Repeat scans first match stored `scanIdentity`/`scanCode`, then fall back to visible tree IDs and conservative common fields.
  - No new schema column is required for this step, but a future dedicated NFC/barcode identity table can migrate these metadata values if needed.

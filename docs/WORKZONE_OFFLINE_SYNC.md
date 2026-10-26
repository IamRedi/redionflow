# Workzone Offline Sync Plan

Status: planned, not implemented yet.

## Goal

Workzone should stay usable when a worker has weak or no network in the field. The app should store selected operational actions locally, show them as pending, and sync them to the server when the network returns.

This is a Workzone-first feature. It is not a full offline rewrite of the admin app.

## Scope For The First Version

Start with small, high-value field actions:

- Start work session
- Stop work session
- Mark tree done / undo tree done
- Add or clear manual Baustelle task
- Add worker/admin report note
- Request / deploy / collect site safety equipment

Later phases:

- Baustelle document/photo uploads
- Worker profile document/photo uploads
- Inventory movements
- Daily plan read cache
- NFC/barcode scan actions

## Non-Goals

- No offline editing for admin project calculation in the first version.
- No hidden local-only truth. The server remains the final source of truth.
- No silent conflict overwrite.
- No storage of company files in `public/uploads`.

## Local Storage Technology

Use IndexedDB, not localStorage.

Reason:

- IndexedDB can store structured records.
- It can hold Blob/File data for later upload.
- It is better suited for queues and larger payloads.

Suggested local stores:

- `outbox`: pending actions waiting for sync.
- `entityCache`: read-only snapshots used to explain conflicts and show last known state.
- `uploadBlobs`: temporary file blobs for later Supabase upload.
- `syncLog`: last sync attempts and errors for debugging.

## Pending Action Shape

Every offline action should be an append-only command:

```ts
type WorkzonePendingAction = {
  id: string;
  type:
    | "START_WORK"
    | "STOP_WORK"
    | "CHECK_TREE"
    | "UNDO_TREE"
    | "ADD_MANUAL_TASK"
    | "CLEAR_MANUAL_TASK"
    | "ADD_REPORT_NOTE"
    | "SITE_EQUIPMENT_MOVEMENT"
    | "UPLOAD_DOCUMENT";
  actorKind: "WORKER" | "ADMIN";
  actorId: string;
  companyProfileId: string;
  entityType: "WORKER" | "BAUSTELLE" | "TREE" | "MANUAL_TASK" | "WORK_SESSION" | "INVENTORY";
  entityId: string;
  payload: unknown;
  baseVersion?: string;
  baseUpdatedAt?: string;
  createdAt: string;
  clientCreatedAt: string;
  status: "pending" | "syncing" | "synced" | "conflict" | "failed";
  attempts: number;
  lastError?: string;
};
```

`id` must be generated on the client and sent to the server as an idempotency key.

## Server Rules

The server decides what is accepted. The client only proposes actions.

Server sync endpoint should:

- Authenticate the current worker/admin session.
- Check that the actor is allowed to perform the action.
- Validate payload with Zod.
- Use the action `id` as an idempotency key.
- Compare `baseUpdatedAt` or version when the action changes existing state.
- Return one of:
  - `synced`
  - `noop`
  - `conflict`
  - `rejected`
  - `retryable_error`

## Conflict Strategy

Prefer event-style, additive data where possible.

Low-conflict actions:

- Add report note
- Add document
- Add material/safety movement
- Start/stop work session with explicit timestamps

These can usually be appended if permissions still pass.

Potential conflict actions:

- Undo tree done after someone else completed/reopened it.
- Clear manual task after someone else changed it.
- Stop work when the server already closed the session.
- Upload document to a Baustelle that was deleted or archived.

Conflict handling:

- If the final state is already the same, return `noop` and mark synced.
- If the entity changed but the requested action is still safe, apply and return `synced_with_server_update`.
- If the action would overwrite meaningful newer work, return `conflict`.
- The UI must show a short review message instead of silently overwriting.

Examples:

- Worker marks tree done offline. Server sees tree already done by someone else. Result: `noop`, show as synced.
- Worker marks tree done offline. Server sees Baustelle deleted. Result: `conflict` or `rejected`.
- Worker stops work offline at 16:30. Server sees the session auto-closed at 16:00. Result: `conflict`, ask admin/worker to review.
- Worker adds a note offline. Server accepts as a new note even if other notes were added meanwhile.

## UI Requirements

Workzone must be honest about sync state:

- Show an offline banner when `navigator.onLine === false`.
- Show a pending counter in Workzone/Profile.
- Mark affected rows/cards with `pending sync`.
- Disable destructive repeat actions while an equivalent pending action exists.
- Let users retry failed actions.
- Let admins see enough context to resolve conflicts.

Never show a pending action as final completed server truth.

## File Uploads Offline

Files may be captured locally only as temporary IndexedDB blobs.

Final storage remains Supabase Storage:

- Worker assets -> `worker-assets`
- Baustelle documents -> `baustelle-documents`

When network returns:

1. Sync metadata/action first if needed.
2. Upload Blob to Supabase through the normal server action/API.
3. Store returned Supabase URL in DB.
4. Delete local Blob after confirmed success.

If browser storage is cleared before sync, unsynced file blobs are lost. UI should warn users when files are pending.

## Suggested Implementation Phases

### Phase 1 - Outbox Foundation

- Add IndexedDB helper under `src/lib/workzone/offline/*`.
- Add `useOnlineStatus`.
- Add Workzone pending badge/banner.
- Add one sync endpoint, for example `/api/workzone/sync`.
- Add idempotency table/model if needed.

### Phase 2 - Time Actions

- Support `START_WORK` and `STOP_WORK`.
- Use explicit client-selected timestamps.
- Server resolves overlap and forgotten-session rules.

### Phase 3 - Tree And Task Actions

- Support `CHECK_TREE`, `UNDO_TREE`, `ADD_MANUAL_TASK`, `CLEAR_MANUAL_TASK`.
- Add conflict responses for changed/deleted entities.

### Phase 4 - Notes And Equipment

- Support report notes and safety/material movements.
- Prefer append-only handling.

### Phase 5 - Documents And Photos

- Store Blobs temporarily in IndexedDB.
- Sync to Supabase only when online.
- Show pending uploads clearly.

## Acceptance Criteria

- A worker can start/stop work without network and later sync successfully.
- A worker can mark a tree done without network and later sync successfully.
- The same offline action cannot be applied twice after retries.
- If another user changed the same entity first, the server returns a clear conflict/noop outcome.
- UI clearly separates pending local actions from synced server data.
- No company files are written to repo/public storage.

## Important Guardrails

- Server remains source of truth.
- Client action IDs are mandatory for idempotency.
- Conflict handling must be explicit.
- Offline support starts in Workzone only.
- Do not weaken auth/permission checks for offline sync.
- Do not use localStorage for operational queues.

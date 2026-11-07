# Private files without Supabase

Worker documents (profile → Documents, also from the admin worker page),
site documents of the admin "new site with documents" form, site document
imports and offline-synced site documents all go through
`src/lib/storage/object-storage.ts`.

| Installation | Where the bytes live |
| --- | --- |
| `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set | Private Supabase buckets, as before |
| Not set (Railway pilot, AL-Steel) | Postgres table `ManagedFile` (`src/lib/storage/db-object-store.ts`) |

Until 07.11.2026 the second case threw "Supabase Storage is not configured"
and the upload ended in a 500 error.

## Rules

- The company of a file comes from its owner (worker or site), never from
  the request. Writes run in `withTenantContext`; the table has forced row
  level security like every tenant table (`managed_file_tenant`).
- One row per file: `scope` (`worker-assets` | `baustelle-documents`),
  `entityId`, `fileName` (unique together), `mime`, `size`, `data`.
  At most 20 MB per file (database check; the upload validation is stricter
  for worker files, 15 MB).
- Reading only through `/api/private-files`, after its session, tenant and
  membership checks (documents only for the worker and admins). The
  reference stored on the worker or site stays `/api/private-files?...`, the
  same format as with Supabase, so switching storage later needs no data
  change on those rows.
- Deleting a document, clearing a site, or aborting an import deletes the rows.
- The encrypted daily database backup now contains these files too.

Profile photos and steel site files already used their own tables
(`AssetPhoto`, `SiteFile`); nothing changed there.

Tests: `src/lib/storage/db-object-store.integration.test.ts` (round trip,
row level security between two companies, import abort and clear, the
private file route for its own and a foreign admin).

## Workzone without a session

`/workzone` and `/workzone/plan` call `companyOrLogin()`
(`src/lib/workzone/company-or-login.ts`): with no signed-in admin or worker
the visitor goes to `/workzone/login` instead of a 500 error page.

# Encrypted pilot database backup

The operator commands are separate from the web app. They do not start a worker
on Railway, change the hosting plan, expose PostgreSQL publicly, or restore into
the source database. Scheduling and Drive upload use the owner's separately
authorized private operator environment; this repository contains no customer
backup, Drive folder ID, credentials or private keys.

## Create

Use a PostgreSQL client and libpq library matching the source major version.
For a private portable tool installation, preserve its library search path
across fresh login/WSL sessions; checking the executable version alone is not
a restore test. The private operator wrapper selects the matching library.
The optional private SSH path is described below. Supply these
server/operator-only variables:

| Variable | Purpose |
| --- | --- |
| `BACKUP_DATABASE_URL` | Source connection, kept in process environment |
| `BACKUP_EXPECTED_COMPANY_ID` | Pinned pilot tenant ID |
| `BACKUP_PUBLIC_KEY_FILE` | RSA public PEM file |
| `BACKUP_OUTPUT_DIR` | Private absolute directory outside the repository |
| `BACKUP_PG_BIN_DIR` | Optional matching PostgreSQL binary directory |
| `BACKUP_SSH_CONFIG_FILE` | Optional private OpenSSH configuration for remote `pg_dump` |
| `BACKUP_SSH_HOST` | Optional alias, default `bauflow-private-backup` |
| `BACKUP_WSL_DISTRO` | Windows local tools, default `Ubuntu` |

Run `npm run backup:create`. The command refuses zero/multiple tenants or a
different tenant. This whole-database pilot backup is intentionally unsuitable
for a shared multi-tenant source; review storage/access scope before onboarding
a second company.

The source transaction is `REPEATABLE READ READ ONLY`. It exports a snapshot,
counts every public table and keeps that snapshot open for `pg_dump` in custom
format. Dumps use compression, no ownership/ACL statements and a five-second
lock wait. The read-only snapshot does hold an MVCC horizon while it runs;
schedule it away from heavy activity and review duration as data grows. Tool
execution times out after five minutes.

The dump streams directly into AES-256-GCM with a fresh key and IV. RSA-OAEP
SHA-256 wraps that data key. The authenticated header identifies the recipient
fingerprint, format, snapshot time and table counts; the database payload is
encrypted. A source failure leaves no accepted final backup. SHA-256 and size
are returned with the encrypted file path. Logs expose only sanitized phases.

The private-key PEM must stay in protected local storage outside Git and Drive.
Generate RSA keys with at least 3,072 bits (the pilot operator uses 4,096). A
separate protected recovery copy of the private key is necessary for resilience
against loss of the operator host. Encrypted backups alone cannot recover it.

For a private Railway database the operator owns an approved loopback tunnel and
regenerates a dedicated SSH configuration from the current database deployment
on every run. `pg_dump` then runs in the database container over native SSH,
preserving its binary output. This avoids a public TCP proxy and version mismatch.
The pinned company check runs over the private tunnel before accepting a copy.

## Verify and rehearse restore

Set `BACKUP_FILE`, `BACKUP_PRIVATE_KEY_FILE` and the matching local PostgreSQL
tools, then run `npm run backup:verify`. GCM authentication must finish before
`pg_restore --list` runs. Decrypted output exists only in a private temporary
directory that is removed in `finally`; an existing destination is never removed
by a failed decrypt.

For a full rehearsal additionally set `BACKUP_RESTORE_DATABASE_URL` to an empty
**loopback** disposable database named `bauflow_restore_*` and
`BACKUP_RESTORE_ACK=disposable-local-only`. The command rejects nonlocal,
unacknowledged, incorrectly named or nonempty targets. Restore uses one
transaction, exits on errors and compares **all public table counts** against
the authenticated snapshot manifest. This is recovery evidence, not a test of
every business relationship. An operator must separately drop that disposable
clone and stop its private server when done.

## Offsite copy and schedule

Upload only a successfully verified `.enc` file to the approved owner-only Drive
folder. Read back its parent, sharing and size. Download it again and match its
SHA-256 with the local receipt before declaring the offsite copy verified.
Keep a private receipt for deduplication, including snapshot time, Drive file ID,
hash and restore outcome. A partial upload/readback failure must not overwrite
the last verified receipt. No old backup is automatically deleted by these tools.

The pilot's daily local Codex automation requires the operator computer and
desktop app to be running with existing Railway/Drive authorization. It is not
a server-side scheduling guarantee or a measured recovery-time objective.

This backup covers the PostgreSQL database, including records and any embedded
binary values. Files stored externally in object storage and external service
state require their own backup/versioning policy. Database URLs pointing to
those files do not constitute copies of their contents.

## Tests and rollback

Archive unit tests cover binary roundtrip, wrong key, header/ciphertext/tag
tampering, source failure and preserving existing plaintext files. A fresh local
PostgreSQL integration fixture uses 40 synthetic workers, 37 synthetic vehicles
and a binary document, then dumps/restores and compares every table. Restoring
into the source is explicitly rejected.

Stopping the operator job leaves application data unchanged. To roll back the
application's AI changes, deploy the previously accepted application revision;
the new quota table may remain. Do not drop customer tables or roll back
business migrations as part of that operation.

# Verification execution policy

Owner decision: 2026-11-01. Applies to this repository and to new repositories created from it.

## During local development

Run development verification directly on the authorized laptop or mini PC. A laptop may start tests on the mini PC through an existing authorized SSH connection over Tailscale; the tests execute on the host that owns the checkout. A cloud chat controlling that host does not make those tests GitHub-hosted CI.

Use the repository's existing verification commands, dependency versions, isolated fixtures, databases, build tools and browser/device requirements. Run focused checks during iteration and all required quality, security, integration, build and release gates before the applicable handoff, merge or release. Never substitute a smaller test set for a required gate. Platform-specific tests run on the appropriate OS/device/emulator.

Do not dispatch or rerun GitHub Actions for routine local commits, pushes or PR updates. GitHub remains the shared source, branch and PR control plane. A GitHub self-hosted runner is still GitHub Actions orchestration; direct local commands are the default for local development.

## When working in cloud

Use the existing Actions verification workflows only for explicitly selected cloud work or an explicitly authorized remote verification. The executing agent starts the appropriate workflow on the exact intended branch/revision and checks the resulting head SHA and all job results. Do not ask the owner to operate the workflow manually. Lack of local access is an access gap, not automatic permission to spend cloud minutes.

Verification-only workflows use explicit `workflow_dispatch` rather than automatic `push`/`pull_request` triggers. Keep their existing job names, commands, assertions, dependencies, services, permissions, security boundaries and evidence retention. Existing scheduled backups, recovery, protected acceptance and release/deployment automation retain their separate contracts and approvals; they are not ordinary development tests.

## Evidence and merge/release gates

### Managed browser fixtures

`npm run test:e2e` is shell-portable; Playwright's configuration supplies SaaS
test mode, one ephemeral signing key shared with its owned Next child, the
synthetic office configuration and evidence directories. It never reuses the
operator's application signing secret, office tenant or AI key. The managed
server still validates the loopback target and disposable database before
starting services, clears provider credentials and owns its mock storage.
Office prerequisites are seeded before each scenario, not inherited from a
previous file. The suite runs serially because those historical scenarios share
one explicitly synthetic office tenant. Use the current configured origin,
accessible actions and authorization matrix when testing routes; retired UI
labels and hidden legacy shortcuts are not product requirements. Preserve the
corresponding data/privacy/permission assertions at the supported entry point.

This fixture contract is test-only. It does not activate office features, AI,
notifications, permissions or credentials in a deployed environment.

Web Push registration uses ephemeral synthetic VAPID keys. The owned server
preloads a local-only delivery transport; it cannot send a real push. Native
PostgreSQL substitutes must use UTC, matching the official disposable image:
`now()::timestamp` fixtures otherwise differ from Prisma's UTC timestamps and
can accidentally exercise the five-second undo path. Keep the original undo
and concurrency assertions; correct the executor timezone instead.

Record the exact commit, relevant dirty-tree/diff identity, host alias, commands, outcomes, skips and artifact references. Keep local verification, GitHub CI, independent review, owner acceptance and deployment separate. A changed source revision invalidates the affected earlier evidence. Missing or failed mandatory checks block acceptance; never report them as passed or create a synthetic green/skip check.

Preserve existing branch protections, required checks and reviewer/owner approval rules. A `workflow_dispatch` run may not satisfy an Actions check required by a PR/ruleset. If that applies, retain the protection and stop the merge: use an authorized compatible PR-event cloud verification or a separately reviewed trusted local-evidence integration. Do not delete a required check, loosen a ruleset, use admin bypass or mark an unexecuted job successful to make the policy fit.

## New repositories and continuation

At repository creation, add this policy and a reference in the repository's agent instructions. Document the real local verification commands and prerequisites. Add cloud verification as explicit opt-in only when needed; do not add automatic per-push/per-PR test runs by habit. Preserve operational automation separately.

At each continuation, read the repository instructions and this policy, identify the execution host and current branch, and confirm that the active work branch has adopted the policy before pushing. If it predates the policy, reconcile only the policy/workflow delta into that branch without overwriting newer tests, unrelated work or another agent's changes. Do not assume a default-branch update changed existing PR branches or another host's unpushed checkout.

RediON Connect owns the reusable workflow rule; this repository owns its executable test commands and technical evidence. Drive records the owner decision and rollout state, not duplicate source code or secret values.

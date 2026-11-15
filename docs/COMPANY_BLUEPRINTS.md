# Versioned company onboarding

Owner decision: 15 November 2026. One application engine, versioned industry
profiles and separate company data. A client installation is not the template.

## Source and boundaries

The first supported base is the steel system at
`4c2c96331d14c4dbbb83d8c49a5499b17a0d2889` (the verified AL Steel source
baseline). This implementation is prepared on the descendant independent Muster
release `6ffa4d94a3093d014198824ed648c7cadf998602`. It does not merge, deploy,
read secrets from, migrate or enroll AL Steel, BaumdienstFlow or another demo.

The source reference identifies reusable code, not a database snapshot. Customer
names, employees, working hours, documents, photos, assets, codes, credentials,
sessions, grants, office memberships and AI conversations are never copied from
an existing company. Production and Muster data remain separate. Public signup
and existing installations are not silently converted to this onboarding path.

## Three layers

| Layer | Contains | Changes |
| --- | --- | --- |
| Shared engine | Workzone, sites, planning, staff, office services, fleet, inventory, repair, documents, calculation | One reviewed code change; no customer fork |
| Versioned profile | Industry, product mode, supported module choices and source provenance | New defaults get a new version; existing snapshots do not change |
| Company | Own identity, owner, configured sites, company knowledge, subsequent operational data and permissions | Tenant-scoped data, never a new copy of application files |

`steel-fabrication@1` enables the factory by default.
`steel-assembly@1` disables the factory by default. Both allow an explicitly
reviewed factory override. All other core modules remain available in v1;
arbitrary module switches are rejected rather than advertised without server
enforcement. Normal role grants and subscriptions still apply independently.
Available office services do not automatically create office seats or configure
their private environment. AI, mail, GPS, external accounts and paid providers
are not enabled by this operation.
Before activating a new installation, review its effective environment: global
provider flags/credentials are deployment configuration, not tenant data. Use
its own private configuration; a profile snapshot alone does not isolate shared
provider credentials or create a provider-side budget.

For a crane company, first compare the closest profile with its actual work.
Fleet, workers, planning, sites, office and repair services are reusable. Crane
dispatch, lift studies, load charts, operator certifications and industry
quotation rules are an adaptation backlog, not claimed capabilities. Add a
reviewed profile/module version once those flows are implemented. The existing
Baumdienst product is another industry base; this first catalog does not claim
to provision its tree/wood workflows yet.

## Review, then create once

The operator command is separate from startup and from pilot maintenance hooks:

```sh
npm run company:plan -- /private/company-input.json
# After reviewing the exact plan and authorized database target:
npm run company:plan -- /private/company-input.json --apply <reviewed-sha256>
```

Preview is offline: it imports no database client, reads no provider secret and
opens no connection. Output contains the profile, enabled/disabled modules,
record counts and review digest; it omits owner details, addresses and knowledge.
Keep the private input and full review with the company's controlled records.
The digest is a review identifier, not authentication or encryption.

Apply requires `DATABASE_URL`/`DIRECT_URL`, an explicit matching
`ONBOARDING_DATABASE_NAME`, a private `PROVISION_OWNER_PASSWORD` (12–256
characters) and the unchanged plan digest. An existing dedicated installation ID
must match the intended new company. No secrets go in command arguments or
committed files. Dedicated mode also refuses a database containing another
company; shared onboarding requires explicitly configured `SAAS_MODE=true`.
Target authorization, database backup and deployment approval
remain separate; this command cannot infer them from a plan.

An input has a unique operator-chosen `key`, `blueprint: {id, version, factory?}`
and `company` using the existing provision schema. That includes legal/display
names, product/country, owner, optional own logo/contact details, up to 50 own
sites and up to 50 own knowledge entries. Unknown top-level fields, unrecognized
versions, incompatible product modes, duplicate site names/knowledge keys and
factory sites in a factory-disabled plan are rejected. There is no source tenant
ID, database-import flag or sample-data switch.

Apply creates `company-<key>` inside one tenant-bound transaction with a
per-key advisory lock. Company, own owner, local 14-day trial subscription,
overhead defaults, requested sites/knowledge and audit either all commit or all
roll back. There is no Stripe call or paid subscription activation. Repeating the
identical reviewed request is a no-op, including concurrent retries; it does not
reset a password. Reusing a key with different input, an existing owner or an
existing visible legal name fails. Existing companies are never attached by name.
The record writer is shared with legacy provisioning to avoid two diverging
implementations; legacy startup hooks and legacy subscription behavior remain
unchanged.

## Factory disabled means disabled

The saved profile is loaded using the authenticated tenant ID. It bounds the
existing access matrix before admin, crew-role or key-button grants. Factory
batch creation, confirmations, factory route editing and catalog mutations are
denied on the server, including direct action calls. Linked production tasks are
also factory work. Office resource links and notification audiences respect the
same capability. A new factory site cannot be created or selected in the admin
forms; Workzone and site cards omit the factory, production window and factory
element list. General operation dashboards remain available. Steel identity is
independent of manufacturing and does not depend on the first site's existence.

New material imports for a factory-disabled company use an explicit
`supply: external` route. Assemblies can enter the receiving/mounting flow with
their quantities intact. No factory timestamp, employee confirmation or
production event is fabricated. Externally supplied items are excluded from
factory output. Existing empty routes retain their old meaning; an empty array
alone never releases an item. Existing tenants' material and history are not
rewritten. Profile changes after onboarding are deliberately unsupported in v1:
changing a running firm's process requires a separate reviewed migration.

## Compatibility, release and rollback

The additive migration introduces nullable `setupProfile` and `setupDigest` on
CompanyProfile. Existing null/null rows retain legacy behavior. Malformed,
unsupported or product-mismatched profiles fail closed; missing tables/columns or
DB errors never become an enabled-module fallback. The schema requires profile
and digest together. No migration updates an existing tenant.

Deploy schema before the matching application release. The first source PR does
not activate new onboarding in a live deployment. A new installation uses the
verified shared release plus its own database/storage/private configuration.
Future code releases are reviewed deployments; frozen profiles pin configuration
defaults, not an old executable or an automatic upgrade of every customer.
Before enrollment, rollback can return the previous application while preserving
the unused additive fields. After enrollment, use a capability-aware release or
take only the new installation offline while correcting it; preserve its data.
Do not erase a real company's profile to bypass a denial or roll back to an
application that ignores its disabled modules.

Validation covers preview privacy, version/default stability, owner/grant denial,
external material routing, transactional creation, concurrent retries, conflicts,
cross-tenant isolation, unchanged legacy behavior, full regression checks and
desktop/narrow theme renders. Record actual commands/revisions and any gaps in
the delivery receipt. Live deployment and physical-phone acceptance are separate.

Presentation assessment: NO_CONTENT_CHANGE. This is internal onboarding work in
review; existing native presentation, showcase and portfolio continue to describe
the deployed app. Do not publish a self-service onboarding claim or raise
readiness until this source has passed its release and runtime gates.

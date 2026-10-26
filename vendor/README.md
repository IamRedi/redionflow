# SheetJS Community Edition distribution

`xlsx-0.20.3.tgz` is the official Apache-2.0 SheetJS distribution from the
maintainer's HTTPS CDN, downloaded on 2026-10-02. Its package identity, version,
license and absence of install lifecycle scripts were inspected before use.
The license remains inside the tarball. Exact source URL, size, SHA256 and SHA512
are in `xlsx-0.20.3.provenance.json`; npm's lockfile records the matching SHA512
SRI. This is local integrity evidence, not a verified maintainer signature.

`package.json` uses `file:vendor/xlsx-0.20.3.tgz`. Commit the tarball with every
lockfile change: clean CI installation uses the repository artifact and does
not contact the SheetJS CDN. The npm-registry `xlsx@0.18.5` distribution has no
patch for the two assessed HIGH advisories. Do not silently revert to it.

Before a future update, obtain the distribution from the official installation
page, check current advisories and artifact identity/integrity/license/scripts,
regenerate the lockfile using npm, then run the spreadsheet characterization
and full SaaS regression gates. `npm audit` alone is insufficient for the
vendored package: explicitly compare its version with advisory affected ranges.

Sources:
- https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- https://github.com/advisories/GHSA-5pgg-2g8v-p4x9

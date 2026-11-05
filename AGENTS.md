<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local verification

Read [docs/LOCAL_CI_POLICY.md](docs/LOCAL_CI_POLICY.md). Routine checks run on
the laptop/mini PC; cloud verification requires explicit selection. Preserve
required assertions and branch protection. Do not merge or deploy this pilot
without owner approval. Never push to its Railway-connected pilot branch as
part of feature preparation.

## Steel UI acceptance

Read [docs/STEEL_PRODUCTION_DASHBOARD.md](docs/STEEL_PRODUCTION_DASHBOARD.md)
before changing the steel shell. Owner correction, 5 November 2026: its footer
belongs at the end of the scrolling content, not in a permanently visible row.
The stationary header/team wrapper stays transparent; desktop alerts sit under
the single KiDraht book icon, with no duplicate admin-menu entry. Preserve the
project's existing visual identity and verify these behaviors at the beginning
and end of desktop/narrow views. The focused regression is
`tests/e2e/steel-footer-header.spec.ts`; local PASS and owner acceptance differ.

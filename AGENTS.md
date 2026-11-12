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
The stationary header/team wrapper stays transparent. Owner clarification after PR44: the scrolling
content must actually pass behind that transparent header on desktop and phone;
testing only its CSS background color is insufficient. Preserve initial clearance
and click access through empty header space. Owner correction,
12 November 2026 supersedes the earlier desktop placement: KiDraht joins fleet,
workshop and alerts on one row. Latest owner correction: this row belongs below
the full-width team strip in normal header flow, with no reserved horizontal
blank area or floating invisible layer over workers. Keep one visible office
entry in the header, not another in the page. Primary home actions use light
orange crystal glass. Office scenes fill the viewport, with individual floating
glass navigation controls and the tenant's original logo on the reception wall.
Photo replacement uses a small camera glyph with an accessible transparent
touch target. Keep the single KiDraht icon with no duplicate admin-menu entry.
Preserve the
project's existing visual identity and verify these behaviors at the beginning
and end of desktop/narrow views. The focused regression is
`tests/e2e/steel-footer-header.spec.ts`; local PASS and owner acceptance differ.

## Assistant logic

Read docs/AI_ASSISTANT.md and docs/AI_COST_LIMITS.md before changing the agent.
Keep Admin Assistant and Worker Helper permissions separate. Use authenticated
company scope, canonical steel metrics and explicit ambiguity/freshness/partial
data; never infer missing facts, add successive production-stage kg, or credit
shared-team output to an individual/checker. A real provider response/activation
is separate from mocked/DB tests. Preserve cost gates, read-only business data
and existing UI. The owner enters provider credentials directly in secret
configuration; never request or record their value in chat/Git/Drive.

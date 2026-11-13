# Private photo previews and mobile review

Owner scope, 13 November 2026: preserve the accepted premium appearance and
business behavior; the oldest expected phones are 2024 models. Do not reduce
visual quality for a marginal speed improvement.

## Baseline and review boundary

Production baseline: `d2846d1797f2a91cd5a49af6b483067ca43ce615` (PR188).
The production review was read-only. Chrome at 390 CSS pixels opened Workzone,
fleet/vehicle detail, workshop, reception/office, mail, tasks, plan/calendar,
dashboard, warehouse/tool detail, employee profile/day report and site stages.
The inspected document widths did not exceed the viewport. This is viewport
simulation on the owner laptop, not a physical iPhone/Safari, GPU/FPS, INP or
Lighthouse certification. No operational start/stop, stock, document or service
commands were exercised against customer data.

Railway's inspected 24-hour resource window had low CPU demand; application
memory averaged about 0.424 GB and peaked at 1.242 GB against an 8 GB limit.
Deployment health showed no recent deployment failures. These are not a claim
that every HTTP request or real-device interaction was measured.

## Bounded change

Small worker, plan, fleet and workshop pictures can request authenticated
96/192-pixel WebP previews. The browser selects them through native `srcset`
and `sizes`, with the original as the high-resolution/legacy fallback.
Square, 4:3 and 6:5 previews match the existing centered `object-cover` frame;
a wide photo is cropped before resizing so a Retina avatar still receives
enough actual pixels in both dimensions. There is no new lossy encoding.

Authorization and tenant resolution run through the unchanged photo reader
before any transformation. Responses retain `private, no-store`, same-origin
and MIME protections. Preview work accepts only the two fixed widths and three
fixed shapes, has a three-second native timeout, and is bounded per process to
two conversions plus sixteen waiters. A waiter falls back after 200 ms. Small
sources, larger/failed conversions or exhausted capacity return the original.
There is no shared/public/private-media cache, provider call or disk/DB write.

Full profiles and opened vehicle cards still request original photo bytes.
Upload conversion, stored originals, CSS, glass blur/opacity, backgrounds,
illustrations, font/layout tokens, GPS, fuel, workshop logic, permissions,
dependencies and schema remain unchanged. Glass was retained: no measured
benefit justified changing its accepted visual material. Fewer decoded image
pixels reduce the image workload without removing the material.

A separate mobile defect was observed using hit-testing: the production worker
profile menu could be covered by the fleet control. The menu now uses the
existing body-portal pattern above navigation, while retaining its position and
classes. Outside-click handling also recognizes the portal. A local profile
navigation check passed.

## Evidence and practical limits

Local isolated fixtures only. The source and final image/tenant tests verify
byte-identical original reads, unchanged stored bytes, foreign/anonymous access
denial, bounded requests, no enlargement, and exact lossless resized/cropped
pixels against all three expected frames. Unit tests, lint, TypeScript,
integration tests and a production build passed. The existing `unpdf` webpack
warning is unrelated to this change; it was not hidden or fixed incidentally.

The representative synthetic photo was 80,710 bytes. Previews were 12,080–49,366
bytes (39–85% smaller) depending on size/frame; three samples per case under
the bounded laptop executor. These are image-byte savings for one fixture, not
an application speed score or a guarantee for every photograph. Larger preview
experiments did not justify their CPU work and were excluded from the candidate.

Before/after desktop and narrow light/dark views retained matching inspected
glass colors, radii and blur values, with no horizontal overflow. Opened profile
and vehicle photos were confirmed to use the full URL. Screenshots and raw
receipts stay in the task's private evidence directory; no customer screenshots
were added to the public showcase.

## Delivery

No production publication is implied by local PASS. Merge/deploy needs the
owner's approval under AGENTS.md. Rollback is the previous application revision;
no data migration or restoration accompanies this change.

Native presentation / portfolio: **NO_CONTENT_CHANGE**. This preserves the
existing product appearance and capabilities; it does not justify another
marketing release or a new readiness/performance claim.

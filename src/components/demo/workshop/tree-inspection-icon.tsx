import type { SVGProps } from "react";

/** Product-scoped tree atlas glyph, on the existing 24px outline grid. */
export function TreeInspectionIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-tree-inspection-icon {...props}>
    <circle cx="9.75" cy="9.75" r="7.25" />
    <path d="m15 15 6.5 6.5" />
    <path d="M7.2 11.8c-2.1.1-2.7-2.6-1-3.7-.5-2.3 2.5-3.7 4-1.9 2.3-.5 3.9 2 2.4 3.7 1 1.9-1.5 3.2-3 1.9" />
    <path d="M9.5 10v4.8m-1.7 0h3.4" />
  </svg>;
}

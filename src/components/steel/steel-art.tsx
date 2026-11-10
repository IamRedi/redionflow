/**
 * Hand-drawn SVG scenes for metal construction: one per work phase and one
 * per site type. Pure SVG + CSS keyframes (no client JS), so they render on
 * the server and stay sharp on any screen. Motion stops for people who ask
 * for reduced motion.
 */

import type { SteelPhaseKey, SteelSiteShape } from "@/lib/workzone/steel-phases";
import { STEEL_ART_PALETTE as C } from "@/lib/steel-work/illustration-style";

const STYLE = `
.sa-spin{transform-box:fill-box;transform-origin:center;animation:sa-spin 1.1s linear infinite}
.sa-bob{animation:sa-bob 2.6s ease-in-out infinite}
.sa-swing{transform-box:fill-box;transform-origin:50% 0;animation:sa-swing 3.4s ease-in-out infinite}
.sa-spark{animation:sa-spark .5s steps(2,end) infinite}
.sa-spark2{animation:sa-spark .5s steps(2,end) .25s infinite}
.sa-glow{animation:sa-glow 1.3s ease-in-out infinite}
.sa-dash{stroke-dasharray:5 4;animation:sa-dash 1.4s linear infinite}
.sa-paint{transform-box:fill-box;transform-origin:0 50%;animation:sa-paint 2.8s ease-in-out infinite alternate}
.sa-roll{animation:sa-roll 2.8s ease-in-out infinite alternate}
.sa-drill{animation:sa-drill 1.8s ease-in-out infinite}
.sa-dip{animation:sa-dip 3.6s ease-in-out infinite}
.sa-blink{animation:sa-glow 2.2s ease-in-out infinite}
@keyframes sa-spin{to{transform:rotate(360deg)}}
@keyframes sa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
@keyframes sa-swing{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
@keyframes sa-spark{0%{opacity:1}100%{opacity:.15}}
@keyframes sa-glow{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes sa-dash{to{stroke-dashoffset:-18}}
@keyframes sa-paint{from{transform:scaleX(1)}to{transform:scaleX(2.2)}}
@keyframes sa-roll{from{transform:translateX(0)}to{transform:translateX(48px)}}
@keyframes sa-drill{0%,100%{transform:translateY(0)}45%,60%{transform:translateY(9px)}}
@keyframes sa-dip{0%,15%{transform:translateY(0)}50%,65%{transform:translateY(16px)}100%{transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.sa-spin,.sa-bob,.sa-swing,.sa-spark,.sa-spark2,.sa-glow,.sa-dash,.sa-paint,.sa-roll,.sa-drill,.sa-dip,.sa-blink{animation:none}}
`;

function cls(animate: boolean, name: string) {
  return animate ? name : undefined;
}

/** I-beam seen from the front: two flanges and a web. */
function Column({ x, y, h, w = 12, fill = C.steel }: { x: number; y: number; h: number; w?: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      <rect x={x} y={y} width={2.5} height={h} fill={C.steelDark} opacity={0.55} />
      <rect x={x + w - 2.5} y={y} width={2.5} height={h} fill={C.steelDark} opacity={0.55} />
      <rect x={x + w / 2 - 1} y={y} width={2} height={h} fill="#fff" opacity={0.18} />
    </g>
  );
}

function Ground() {
  return (
    <g>
      <rect x="0" y="100" width="160" height="20" fill={C.ground} opacity="0.25" />
      <line x1="0" y1="100" x2="160" y2="100" stroke={C.ground} strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}

function Hook({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 4} y={y - 6} width="8" height="6" rx="1.5" fill={C.orange} />
      <path d={`M${x} ${y} v4 a3 3 0 1 1 -3 3`} fill="none" stroke={C.steelDark} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Foundation({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <polygon points="46,70 114,70 122,80 38,80" fill={C.concreteTop} />
      <polygon points="38,80 122,80 122,100 38,100" fill={C.concrete} />
      <polygon points="38,80 46,70 46,90 38,100" fill={C.ground} opacity="0.35" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={44 + i * 17} y="84" width="9" height="3" rx="1" fill={C.ground} opacity="0.25" />
      ))}
      {/* Concrete only: anchor bolts are a separate process. Formwork edge being poured. */}
      <rect x="40" y="68" width="80" height="3" rx="1" fill="none" stroke={C.orange} strokeWidth="1.6" className={cls(animate, "sa-dash")} />
      <circle cx="132" cy="40" r="4" fill={C.orange} className={cls(animate, "sa-blink")} />
    </g>
  );
}

function Columns({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="22" y="94" width="28" height="6" fill={C.concrete} />
      <rect x="110" y="94" width="28" height="6" fill={C.concrete} />
      <rect x="27" y="91" width="18" height="3" fill={C.steelDark} />
      <rect x="115" y="91" width="18" height="3" fill={C.steelDark} />
      <Column x={30} y={30} h={61} />
      <Column x={118} y={30} h={61} />
      <rect x="66" y="94" width="28" height="6" fill={C.concrete} />
      <rect x="71" y="91" width="18" height="3" fill={C.steelDark} opacity="0.6" />
      <g className={cls(animate, "sa-bob")}>
        <line x1="80" y1="0" x2="80" y2="16" stroke={C.steelDark} strokeWidth="1.2" />
        <Hook x={80} y={18} />
        <line x1="80" y1="26" x2="74" y2="34" stroke={C.steelDark} strokeWidth="1" />
        <line x1="80" y1="26" x2="86" y2="34" stroke={C.steelDark} strokeWidth="1" />
        <Column x={74} y={33} h={50} fill={C.orange} />
      </g>
    </g>
  );
}

function Trusses({ animate }: { animate: boolean }) {
  const bottom = 50;
  const xs = [20, 50, 80, 110, 140];
  const top = (x: number) => bottom - 26 * (1 - Math.abs(x - 80) / 60);
  return (
    <g>
      <Ground />
      <Column x={18} y={50} h={50} w={10} />
      <Column x={132} y={50} h={50} w={10} />
      <g className={cls(animate, "sa-swing")}>
        <line x1="80" y1="0" x2="80" y2="14" stroke={C.steelDark} strokeWidth="1.2" />
        <Hook x={80} y={16} />
        <line x1="80" y1="24" x2="40" y2="38" stroke={C.steelDark} strokeWidth="0.9" />
        <line x1="80" y1="24" x2="120" y2="38" stroke={C.steelDark} strokeWidth="0.9" />
        <g stroke={C.orange} strokeLinecap="round">
          <polyline points={`20,${bottom} 80,${top(80)} 140,${bottom}`} fill="none" strokeWidth="3.2" />
          <line x1="20" y1={bottom} x2="140" y2={bottom} strokeWidth="3.2" />
          {xs.slice(1, -1).map((x) => (
            <line key={x} x1={x} y1={bottom} x2={x} y2={top(x)} strokeWidth="1.6" />
          ))}
          <line x1="50" y1={bottom} x2="80" y2={top(80)} strokeWidth="1.4" />
          <line x1="110" y1={bottom} x2="80" y2={top(80)} strokeWidth="1.4" />
          <line x1="20" y1={bottom} x2="50" y2={top(50)} strokeWidth="1.4" />
          <line x1="140" y1={bottom} x2="110" y2={top(110)} strokeWidth="1.4" />
        </g>
      </g>
    </g>
  );
}

function Painting({ animate }: { animate: boolean }) {
  return (
    <g>
      <rect x="10" y="94" width="140" height="4" rx="1" fill={C.ground} opacity="0.4" />
      <rect x="22" y="80" width="4" height="14" fill={C.steelDark} />
      <rect x="134" y="80" width="4" height="14" fill={C.steelDark} />
      <rect x="14" y="54" width="132" height="26" fill={C.steelLight} />
      <rect x="14" y="54" width="132" height="5" fill={C.steel} />
      <rect x="14" y="75" width="132" height="5" fill={C.steel} />
      <rect x="14" y="54" width="40" height="26" fill={C.primer} opacity="0.92" className={cls(animate, "sa-paint")} />
      <g className={cls(animate, "sa-roll")}>
        {/* Paint roller pressed on the web, handle up to the right */}
        <rect x="50" y="57" width="9" height="20" rx="3" fill={C.orange} />
        <rect x="51.5" y="57" width="2" height="20" fill="#fff" opacity="0.35" />
        <polyline points="59,60 66,60 66,40 76,24" fill="none" stroke={C.steelDark} strokeWidth="2" strokeLinejoin="round" />
        <line x1="76" y1="24" x2="86" y2="8" stroke={C.steelDark} strokeWidth="5" strokeLinecap="round" />
        <circle cx="48" cy="62" r="1.4" fill={C.primer} className={cls(animate, "sa-spark")} />
        <circle cx="47" cy="72" r="1.1" fill={C.primer} className={cls(animate, "sa-spark2")} />
      </g>
    </g>
  );
}

function Cutting({ animate }: { animate: boolean }) {
  return (
    <g>
      <rect x="14" y="76" width="132" height="6" fill={C.steelDark} />
      <rect x="20" y="82" width="5" height="18" fill={C.steelDark} />
      <rect x="135" y="82" width="5" height="18" fill={C.steelDark} />
      <rect x="10" y="64" width="140" height="12" fill={C.steelLight} />
      <rect x="10" y="64" width="140" height="3" fill={C.steel} />
      <path d="M76 22 h40 v10 h-24 z" fill={C.orange} />
      <rect x="112" y="18" width="18" height="10" rx="2" fill={C.steelDark} />
      <g className={cls(animate, "sa-spin")}>
        <circle cx="96" cy="50" r="17" fill={C.zinc} stroke={C.steel} strokeWidth="2.5" strokeDasharray="3 2" />
        <circle cx="96" cy="50" r="4" fill={C.steelDark} />
        <line x1="96" y1="36" x2="96" y2="64" stroke={C.steel} strokeWidth="1" />
      </g>
      <path d="M78 40 a20 20 0 0 1 36 0" fill="none" stroke={C.orange} strokeWidth="4" />
      <g stroke={C.spark} strokeWidth="1.6" strokeLinecap="round">
        <line x1="80" y1="64" x2="64" y2="56" className={cls(animate, "sa-spark")} />
        <line x1="80" y1="65" x2="60" y2="63" className={cls(animate, "sa-spark2")} />
        <line x1="81" y1="66" x2="66" y2="72" className={cls(animate, "sa-spark")} />
      </g>
    </g>
  );
}

function Drilling({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="112" y="18" width="10" height="82" fill={C.steelDark} />
      <rect x="98" y="92" width="38" height="8" fill={C.steel} />
      <rect x="56" y="74" width="70" height="6" fill={C.steel} />
      <rect x="40" y="66" width="80" height="8" fill={C.steelLight} />
      {[52, 66].map((x) => (
        <ellipse key={x} cx={x} cy="70" rx="3.2" ry="2" fill={C.steelDark} />
      ))}
      <ellipse cx="82" cy="70" rx="3.6" ry="2.2" fill="none" stroke={C.orange} strokeWidth="1.4" className={cls(animate, "sa-dash")} />
      <rect x="66" y="16" width="56" height="20" rx="3" fill={C.orange} />
      <circle cx="112" cy="26" r="3" fill={C.steelDark} />
      <g className={cls(animate, "sa-drill")}>
        <rect x="77" y="36" width="10" height="12" fill={C.steelDark} />
        <polygon points="80,48 84,48 82,60" fill={C.steel} />
      </g>
    </g>
  );
}

function Welding({ animate }: { animate: boolean }) {
  return (
    <g>
      <defs>
        <radialGradient id="sa-weld-glow">
          <stop offset="0" stopColor={C.spark} stopOpacity="0.9" />
          <stop offset="1" stopColor={C.orange} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="10" y="94" width="140" height="6" fill={C.steelDark} />
      <rect x="24" y="80" width="100" height="14" fill={C.steelLight} />
      <rect x="64" y="40" width="12" height="40" fill={C.steel} />
      <line x1="64" y1="80" x2="76" y2="80" stroke={C.orange} strokeWidth="3" className={cls(animate, "sa-glow")} />
      <circle cx="78" cy="78" r="16" fill="url(#sa-weld-glow)" className={cls(animate, "sa-glow")} />
      <g>
        <line x1="82" y1="74" x2="118" y2="36" stroke={C.steelDark} strokeWidth="5" strokeLinecap="round" />
        <line x1="118" y1="36" x2="140" y2="28" stroke={C.orange} strokeWidth="6" strokeLinecap="round" />
      </g>
      <g stroke={C.spark} strokeWidth="1.5" strokeLinecap="round">
        <line x1="78" y1="78" x2="60" y2="66" className={cls(animate, "sa-spark")} />
        <line x1="78" y1="78" x2="96" y2="64" className={cls(animate, "sa-spark2")} />
        <line x1="78" y1="78" x2="58" y2="84" className={cls(animate, "sa-spark2")} />
        <line x1="78" y1="78" x2="92" y2="90" className={cls(animate, "sa-spark")} />
        <line x1="78" y1="78" x2="74" y2="58" className={cls(animate, "sa-spark")} />
      </g>
    </g>
  );
}

function Coating({ animate }: { animate: boolean }) {
  return (
    <g>
      <line x1="10" y1="8" x2="150" y2="8" stroke={C.steelDark} strokeWidth="3" />
      <g className={cls(animate, "sa-dip")}>
        <rect x="74" y="8" width="12" height="7" fill={C.orange} />
        <line x1="80" y1="15" x2="80" y2="28" stroke={C.steelDark} strokeWidth="1.2" />
        <line x1="80" y1="28" x2="50" y2="40" stroke={C.steelDark} strokeWidth="1" />
        <line x1="80" y1="28" x2="110" y2="40" stroke={C.steelDark} strokeWidth="1" />
        <rect x="40" y="40" width="80" height="14" fill={C.steelLight} />
        <rect x="40" y="40" width="80" height="3" fill={C.steel} />
        <rect x="40" y="51" width="80" height="3" fill={C.steel} />
      </g>
      <rect x="24" y="62" width="112" height="38" rx="2" fill={C.steelDark} />
      <rect x="28" y="66" width="104" height="30" fill={C.zinc} opacity="0.85" />
      <path d="M28 68 q13 -3 26 0 t26 0 t26 0 t26 0" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.8" className={cls(animate, "sa-glow")} />
    </g>
  );
}

function Laser({ animate }: { animate: boolean }) {
  return (
    <g>
      <rect x="12" y="84" width="136" height="6" fill={C.steelDark} />
      <rect x="18" y="90" width="5" height="10" fill={C.steelDark} />
      <rect x="137" y="90" width="5" height="10" fill={C.steelDark} />
      <rect x="16" y="76" width="128" height="8" fill={C.steelLight} />
      {/* Cut contour already traced on the plate */}
      <path d="M40 80 h28 a4 4 0 0 0 4 -4" fill="none" stroke={C.steelDark} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.7" />
      <rect x="10" y="14" width="140" height="7" rx="2" fill={C.steelDark} />
      <g className={cls(animate, "sa-roll")}>
        <rect x="58" y="21" width="22" height="18" rx="3" fill={C.orange} />
        <polygon points="64,39 74,39 71,50 67,50" fill={C.steel} />
        <line x1="69" y1="50" x2="69" y2="76" stroke="#ef4444" strokeWidth="1.8" className={cls(animate, "sa-glow")} />
        <circle cx="69" cy="77" r="4.5" fill={C.spark} opacity="0.55" className={cls(animate, "sa-glow")} />
        <line x1="69" y1="77" x2="62" y2="72" stroke={C.spark} strokeWidth="1.2" className={cls(animate, "sa-spark")} />
        <line x1="69" y1="77" x2="77" y2="73" stroke={C.spark} strokeWidth="1.2" className={cls(animate, "sa-spark2")} />
      </g>
    </g>
  );
}

function Final({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x={30 + row * 4} y={86 - row * 12} width={92 - row * 8} height="10" fill={C.primer} stroke={C.steelDark} strokeWidth="0.8" />
          <rect x={30 + row * 4} y={86 - row * 12} width={92 - row * 8} height="2.5" fill="#000" opacity="0.15" />
        </g>
      ))}
      <rect x="40" y="96" width="8" height="4" fill={C.ground} />
      <rect x="104" y="96" width="8" height="4" fill={C.ground} />
      {/* Ready tag */}
      <g className={cls(animate, "sa-bob")}>
        <line x1="118" y1="62" x2="128" y2="40" stroke={C.steelDark} strokeWidth="1" />
        <rect x="120" y="22" width="30" height="20" rx="4" fill="#16a34a" />
        <path d="M128 32 l4 4 l8 -8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}


function Task({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      {/* Clipboard with a checklist and a hard hat */}
      <rect x="48" y="22" width="56" height="74" rx="5" fill="#fff" stroke={C.steel} strokeWidth="2" />
      <rect x="64" y="16" width="24" height="10" rx="3" fill={C.steel} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="56" y={36 + i * 18} width="9" height="9" rx="2" fill="none" stroke={C.steel} strokeWidth="1.6" />
          <rect x="70" y={39 + i * 18} width="26" height="3.5" rx="1.5" fill={C.steelLight} />
        </g>
      ))}
      <path d="M57.5 40.5 l2.5 2.5 l5 -6" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <g className={cls(animate, "sa-bob")}>
        <path d="M108 86 a18 15 0 0 1 36 0 z" fill={C.orange} />
        <rect x="104" y="85" width="44" height="5" rx="2" fill={C.primer} />
        <rect x="124" y="70" width="4" height="15" fill="#fff" opacity="0.35" />
      </g>
    </g>
  );
}

export type SteelArtKey = SteelPhaseKey | "laser" | "assembly" | "final";

const PHASE_SCENES: Record<SteelArtKey, (props: { animate: boolean }) => React.ReactElement> = {
  foundation: Foundation,
  columns: Columns,
  trusses: Trusses,
  painting: Painting,
  cutting: Cutting,
  drilling: Drilling,
  welding: Welding,
  coating: Coating,
  laser: Laser,
  assembly: Welding,
  final: Final,
  task: Task,
};

export function SteelPhaseArt({ phase, animate = true, className }: { phase: SteelArtKey; animate?: boolean; className?: string }) {
  const Scene = PHASE_SCENES[phase];
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <style>{STYLE}</style>
      <Scene animate={animate} />
    </svg>
  );
}

/** Wide scene for a site card: a steel hall in the making or the workshop. */
export function SteelSiteArt({
  type,
  pct,
  live,
  className,
  fit = "slice",
  shape = "hall",
}: {
  type: string;
  /** Drawing for an on-site job: industrial hall, bridge or multi-storey frame. */
  shape?: SteelSiteShape;
  pct: number;
  live: boolean;
  className?: string;
  /** "slice" fills a card banner; "meet" keeps the whole scene on the right of a wide hero. */
  fit?: "slice" | "meet";
}) {
  return (
    <svg viewBox="0 0 240 110" className={className} role="img" aria-hidden="true" preserveAspectRatio={fit === "meet" ? "xMaxYMax meet" : "xMidYMax slice"}>
      <style>{STYLE}</style>
      <defs>
        <linearGradient id="sa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fed7aa" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e2e8f0" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="240" height="110" fill="url(#sa-sky)" />
      <rect x="0" y="96" width="240" height="14" fill={C.ground} opacity="0.28" />
      {type === "STEEL_WORKSHOP" ? (
        <WorkshopScene live={live} pct={pct} />
      ) : shape === "bridge" ? (
        <BridgeScene live={live} pct={pct} />
      ) : shape === "building" ? (
        <BuildingScene live={live} pct={pct} />
      ) : (
        <AssemblyScene live={live} pct={pct} />
      )}
    </svg>
  );
}

function AssemblyScene({ live, pct }: { live: boolean; pct: number }) {
  const xs = [26, 76, 126, 176];
  const columnsOn = pct >= 25;
  const trussOn = pct >= 50;
  const painted = pct >= 75;
  const columnFill = painted ? C.primer : C.steel;
  return (
    <g>
      {xs.map((x) => (
        <rect key={`pad-${x}`} x={x - 6} y="92" width="22" height="5" fill={C.concrete} />
      ))}
      {xs.map((x) =>
        columnsOn ? (
          <Column key={`col-${x}`} x={x} y={44} h={48} w={10} fill={columnFill} />
        ) : (
          <rect key={`col-${x}`} x={x} y="44" width="10" height="48" fill="none" stroke={C.steel} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        ),
      )}
      <g stroke={trussOn ? (painted ? C.primer : C.orange) : C.steel} strokeLinecap="round" opacity={trussOn ? 1 : 0.35} strokeDasharray={trussOn ? undefined : "4 3"}>
        <polyline points="26,44 106,22 186,44" fill="none" strokeWidth="3" />
        <line x1="26" y1="44" x2="186" y2="44" strokeWidth="2.6" />
        {[46, 66, 86, 106, 126, 146, 166].map((x) => {
          const top = 44 - 22 * (1 - Math.abs(x - 106) / 80);
          return <line key={x} x1={x} y1="44" x2={x} y2={top} strokeWidth="1.2" />;
        })}
      </g>
      {/* Tower crane */}
      <g>
        <rect x="214" y="12" width="7" height="85" fill="none" stroke={C.orange} strokeWidth="1.6" />
        {[20, 32, 44, 56, 68, 80].map((y) => (
          <line key={y} x1="214" y1={y} x2="221" y2={y + 10} stroke={C.orange} strokeWidth="1" />
        ))}
        <line x1="120" y1="12" x2="236" y2="12" stroke={C.orange} strokeWidth="3" />
        <rect x="224" y="12" width="12" height="7" fill={C.steelDark} />
        <line x1="217" y1="4" x2="140" y2="12" stroke={C.steelDark} strokeWidth="0.8" />
        <line x1="217" y1="4" x2="236" y2="12" stroke={C.steelDark} strokeWidth="0.8" />
        <g className={cls(live, "sa-swing")}>
          <line x1="150" y1="12" x2="150" y2="34" stroke={C.steelDark} strokeWidth="1" />
          <Hook x={150} y={36} />
        </g>
      </g>
      {live ? <circle cx="10" cy="10" r="4" fill="#22c55e" className="sa-blink" /> : null}
    </g>
  );
}


/** Steel girder bridge: piers, deck, then the arch truss and paint, built up with progress. */
function BridgeScene({ live, pct }: { live: boolean; pct: number }) {
  const deckOn = pct >= 25;
  const archOn = pct >= 50;
  const painted = pct >= 75;
  const steel = painted ? C.primer : C.steel;
  return (
    <g>
      {/* River */}
      <rect x="0" y="92" width="240" height="18" fill="#7dd3fc" opacity="0.45" />
      <path d="M0 96 q15 -3 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#e0f2fe" strokeWidth="1.2" className={cls(live, "sa-dash")} />
      {/* Banks */}
      <polygon points="0,70 24,70 34,96 0,96" fill={C.concrete} />
      <polygon points="240,70 216,70 206,96 240,96" fill={C.concrete} />
      {/* Piers */}
      {[84, 156].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="70" width="12" height="28" fill={C.concrete} />
          <rect x={x - 9} y="66" width="18" height="5" fill={C.concreteTop} />
        </g>
      ))}
      {/* Deck */}
      {deckOn ? (
        <g>
          <rect x="18" y="64" width="204" height="6" fill={steel} />
          <rect x="18" y="64" width="204" height="1.6" fill="#fff" opacity="0.25" />
        </g>
      ) : (
        <rect x="18" y="64" width="204" height="6" fill="none" stroke={C.steel} strokeDasharray="4 3" opacity="0.5" />
      )}
      {/* Arch truss */}
      <g stroke={archOn ? steel : C.steel} strokeLinecap="round" fill="none" opacity={archOn ? 1 : 0.35} strokeDasharray={archOn ? undefined : "4 3"}>
        <path d="M30 64 Q120 6 210 64" strokeWidth="3.2" />
        {[50, 70, 90, 110, 130, 150, 170, 190].map((x) => {
          const t = (x - 30) / 180;
          const y = 64 - 4 * 29 * t * (1 - t) * 2;
          return <line key={x} x1={x} y1="64" x2={x} y2={y} strokeWidth="1.3" />;
        })}
      </g>
      {/* Mobile crane on the bank */}
      <g>
        <rect x="222" y="60" width="16" height="9" rx="1.5" fill={C.orange} />
        <line x1="230" y1="60" x2="196" y2="18" stroke={C.orange} strokeWidth="2.4" />
        <g className={cls(live, "sa-swing")}>
          <line x1="196" y1="18" x2="196" y2="38" stroke={C.steelDark} strokeWidth="1" />
          <Hook x={196} y={40} />
        </g>
      </g>
      {live ? <circle cx="10" cy="10" r="4" fill="#22c55e" className="sa-blink" /> : null}
    </g>
  );
}

/** Multi-storey steel frame (hotel, theatre, tower): storeys rise with progress. */
function BuildingScene({ live, pct }: { live: boolean; pct: number }) {
  const storeys = 5;
  const built = Math.max(1, Math.round((pct / 100) * storeys));
  const painted = pct >= 75;
  const xs = [40, 80, 120, 160];
  return (
    <g>
      <rect x="32" y="93" width="144" height="4" fill={C.concrete} />
      {Array.from({ length: storeys }).map((_, i) => {
        const yTop = 93 - (i + 1) * 15;
        const on = i < built;
        const fill = painted ? C.primer : C.steel;
        return (
          <g key={i} opacity={on ? 1 : 0.35}>
            {xs.map((x) =>
              on ? (
                <rect key={x} x={x - 2} y={yTop} width="4" height="15" fill={fill} />
              ) : (
                <rect key={x} x={x - 2} y={yTop} width="4" height="15" fill="none" stroke={C.steel} strokeWidth="0.8" strokeDasharray="2 2" />
              ),
            )}
            <rect x="38" y={yTop} width="126" height="3" fill={on ? fill : "none"} stroke={on ? undefined : C.steel} strokeWidth="0.8" strokeDasharray={on ? undefined : "3 2"} />
            {on && i % 2 === 0 ? <line x1="42" y1={yTop + 15} x2="78" y2={yTop + 3} stroke={C.steelLight} strokeWidth="1" /> : null}
            {on && i % 2 === 1 ? <line x1="122" y1={yTop + 3} x2="158" y2={yTop + 15} stroke={C.steelLight} strokeWidth="1" /> : null}
            {on && i < built - 1 ? <rect x="84" y={yTop + 5} width="32" height="7" fill="#bae6fd" opacity="0.6" /> : null}
          </g>
        );
      })}
      {/* Tower crane */}
      <g>
        <rect x="196" y="8" width="7" height="89" fill="none" stroke={C.orange} strokeWidth="1.6" />
        {[16, 28, 40, 52, 64, 76].map((y) => (
          <line key={y} x1="196" y1={y} x2="203" y2={y + 10} stroke={C.orange} strokeWidth="1" />
        ))}
        <line x1="110" y1="8" x2="236" y2="8" stroke={C.orange} strokeWidth="3" />
        <rect x="222" y="8" width="12" height="7" fill={C.steelDark} />
        <g className={cls(live, "sa-swing")}>
          <line x1="140" y1="8" x2="140" y2={Math.max(14, 93 - built * 15 - 14)} stroke={C.steelDark} strokeWidth="1" />
          <Hook x={140} y={Math.max(16, 93 - built * 15 - 12)} />
        </g>
      </g>
      {live ? <circle cx="10" cy="10" r="4" fill="#22c55e" className="sa-blink" /> : null}
    </g>
  );
}

function WorkshopScene({ live, pct }: { live: boolean; pct: number }) {
  return (
    <g>
      {/* Hall with a sawtooth roof */}
      <polygon points="18,96 18,40 60,22 60,40 102,22 102,40 144,22 144,40 186,22 186,96" fill="#e2e8f0" stroke={C.steel} strokeWidth="2" />
      {[60, 102, 144, 186].map((x) => (
        <rect key={x} x={x - 3} y="24" width="3" height="16" fill="#bae6fd" opacity="0.9" />
      ))}
      <rect x="18" y="40" width="168" height="5" fill={C.steel} />
      <rect x="66" y="52" width="72" height="44" fill={C.steelDark} />
      <line x1="66" y1="58" x2="138" y2="58" stroke={C.orange} strokeWidth="2" />
      <rect x="74" y="80" width="56" height="6" fill={C.steelLight} />
      <rect x="98" y="66" width="6" height="14" fill={C.steelLight} />
      <circle cx="101" cy="80" r="7" fill={C.spark} opacity="0.35" className={cls(live, "sa-glow")} />
      <g stroke={C.spark} strokeWidth="1.3" strokeLinecap="round" opacity={live ? 1 : 0}>
        <line x1="101" y1="80" x2="92" y2="72" className={cls(live, "sa-spark")} />
        <line x1="101" y1="80" x2="110" y2="71" className={cls(live, "sa-spark2")} />
        <line x1="101" y1="80" x2="112" y2="84" className={cls(live, "sa-spark")} />
      </g>
      <rect x="28" y="56" width="26" height="16" fill="#bae6fd" opacity="0.8" stroke={C.steel} />
      <rect x="150" y="56" width="26" height="16" fill="#bae6fd" opacity="0.8" stroke={C.steel} />
      {/* Stack of finished beams grows with progress */}
      {Array.from({ length: Math.min(4, Math.round(pct / 25)) }).map((_, i) => (
        <rect key={i} x="196" y={90 - i * 5} width="34" height="4" fill={C.primer} stroke={C.steelDark} strokeWidth="0.6" />
      ))}
      {live ? <circle cx="10" cy="10" r="4" fill="#22c55e" className="sa-blink" /> : null}
    </g>
  );
}

/** Round progress gauge with an animated sweep. */
export function SteelProgressRing({ pct, size = 56, label }: { pct: number; size?: number; label?: string }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const done = clamped >= 100;
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={label ?? `${clamped}%`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={done ? "#10b981" : C.orange}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
        {clamped}%
      </text>
    </svg>
  );
}

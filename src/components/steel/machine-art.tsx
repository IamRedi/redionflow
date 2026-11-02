/**
 * SVG drawings for fleet machines (crane, aerial lift, truck, welder,
 * forklift). Pure SVG + CSS, gentle motion that stops for reduced motion.
 */

export type MachineKind = "crane" | "lift" | "truck" | "welder" | "forklift" | "generic";

export function machineKind(input: { name: string; nickname?: string | null; funksioni?: string | null; model?: string | null; category?: string | null }): MachineKind {
  const text = [input.name, input.nickname, input.funksioni, input.model].filter(Boolean).join(" ").toLowerCase();
  if (/(vinç|vinc|kran|crane|autovin)/.test(text)) return "crane";
  if (/(saldim|saldatr|welder|schweiß|schweiss|mig|tig)/.test(text)) return "welder";
  if (/(pirun|forklift|stapler|karrel)/.test(text)) return "forklift";
  if (/(platform|ngrit|hubsteiger|bühne|buehne|lift|skylift)/.test(text) || input.category === "AWP") return "lift";
  if (/(kamion|truck|lkw|furgon|transport)/.test(text) || input.category === "TRUCK") return "truck";
  return "generic";
}

const C = {
  body: "#f97316",
  bodyDark: "#c2410c",
  steel: "#475569",
  steelDark: "#1e293b",
  glass: "#bae6fd",
  tyre: "#0f172a",
  hub: "#94a3b8",
  ground: "#78716c",
  spark: "#fde047",
};

const STYLE = `
.ma-swing{transform-box:fill-box;transform-origin:50% 0;animation:ma-swing 3.2s ease-in-out infinite}
.ma-rise{animation:ma-rise 3.4s ease-in-out infinite}
.ma-spark{animation:ma-spark .45s steps(2,end) infinite}
.ma-fork{animation:ma-fork 3s ease-in-out infinite}
@keyframes ma-swing{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes ma-rise{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes ma-spark{0%{opacity:1}100%{opacity:.1}}
@keyframes ma-fork{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@media (prefers-reduced-motion: reduce){.ma-swing,.ma-rise,.ma-spark,.ma-fork{animation:none}}
`;

function Wheel({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={C.tyre} />
      <circle cx={x} cy={y} r={r * 0.45} fill={C.hub} />
    </g>
  );
}

function Ground() {
  return <rect x="0" y="104" width="200" height="16" fill={C.ground} opacity="0.22" />;
}

function Cab({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y + 30} v-22 q0 -8 8 -8 h18 l10 14 v16 z`} fill={C.body} />
      <path d={`M${x + 22} ${y + 4} h4 l8 11 h-12 z`} fill={C.glass} />
      <rect x={x + 4} y={y + 6} width="12" height="9" rx="1.5" fill={C.glass} />
    </g>
  );
}

function Crane({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="40" y="76" width="120" height="18" rx="3" fill={C.body} />
      <rect x="40" y="88" width="120" height="6" fill={C.bodyDark} />
      <Cab x={150} y={60} />
      {[56, 82, 108, 134, 172].map((x) => (
        <Wheel key={x} x={x} y={98} />
      ))}
      {/* Outriggers */}
      <rect x="34" y="92" width="6" height="12" fill={C.steel} />
      <rect x="126" y="92" width="6" height="12" fill={C.steel} />
      {/* Telescopic boom */}
      <rect x="70" y="62" width="22" height="16" rx="2" fill={C.steelDark} />
      <g transform="rotate(-38 80 68)">
        <rect x="78" y="62" width="96" height="10" rx="2" fill={C.body} />
        <rect x="150" y="63.5" width="40" height="7" rx="1.5" fill={C.bodyDark} />
      </g>
      <g className={animate ? "ma-swing" : undefined}>
        <line x1="150" y1="10" x2="150" y2="44" stroke={C.steelDark} strokeWidth="1.4" />
        <rect x="144" y="44" width="12" height="6" rx="1.5" fill={C.body} />
        <path d="M150 50 v5 a4 4 0 1 1 -4 4" fill="none" stroke={C.steelDark} strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Lift({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="50" y="82" width="100" height="14" rx="3" fill={C.steelDark} />
      <Wheel x={66} y={98} />
      <Wheel x={134} y={98} />
      <g className={animate ? "ma-rise" : undefined}>
        {/* Scissor arms */}
        <g stroke={C.body} strokeWidth="5" strokeLinecap="round">
          <line x1="62" y1="80" x2="138" y2="58" />
          <line x1="62" y1="58" x2="138" y2="80" />
          <line x1="62" y1="58" x2="138" y2="36" />
          <line x1="62" y1="36" x2="138" y2="58" />
        </g>
        <rect x="52" y="24" width="96" height="12" rx="2" fill={C.steel} />
        <path d="M54 24 v-14 h92 v14" fill="none" stroke={C.steelDark} strokeWidth="2.4" />
        <line x1="78" y1="10" x2="78" y2="24" stroke={C.steelDark} strokeWidth="1.6" />
        <line x1="122" y1="10" x2="122" y2="24" stroke={C.steelDark} strokeWidth="1.6" />
      </g>
    </g>
  );
}

function Truck(_props: { animate: boolean }) {
  return (
    <g>
      <Ground />
      {/* Flatbed with a load of steel beams */}
      <rect x="24" y="74" width="116" height="10" rx="2" fill={C.steelDark} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={30 + i * 2} y={62 - i * 8} width={102 - i * 4} height="7" fill="#c2410c" stroke={C.steelDark} strokeWidth="0.7" />
      ))}
      {/* Loader crane folded behind the cab */}
      <rect x="138" y="44" width="8" height="32" fill={C.body} />
      <rect x="96" y="30" width="50" height="7" rx="1.5" fill={C.body} />
      <Cab x={146} y={52} />
      <rect x="146" y="80" width="40" height="6" fill={C.bodyDark} />
      {[44, 66, 162].map((x) => (
        <Wheel key={x} x={x} y={96} r={9} />
      ))}
    </g>
  );
}

function Welder({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      {/* Welding machine on a trolley */}
      <rect x="40" y="46" width="62" height="48" rx="5" fill={C.body} />
      <rect x="48" y="54" width="30" height="14" rx="2" fill={C.steelDark} />
      <rect x="52" y="58" width="16" height="6" rx="1" fill={C.spark} opacity="0.85" />
      <circle cx="88" cy="61" r="6" fill={C.steelDark} />
      <circle cx="56" cy="82" r="4" fill={C.steelDark} />
      <circle cx="72" cy="82" r="4" fill="#dc2626" />
      <Wheel x={50} y={98} r={6} />
      <Wheel x={92} y={98} r={6} />
      <path d="M40 46 v-10 h10" fill="none" stroke={C.steel} strokeWidth="3" />
      {/* Cable and torch to a steel beam */}
      <path d="M102 80 C 124 96, 128 60, 146 66" fill="none" stroke={C.steelDark} strokeWidth="3" strokeLinecap="round" />
      <rect x="120" y="84" width="64" height="8" fill={C.steel} />
      <rect x="148" y="62" width="6" height="22" fill={C.steel} />
      <circle cx="148" cy="80" r="7" fill={C.spark} opacity="0.35" className={animate ? "ma-spark" : undefined} />
      <g stroke={C.spark} strokeWidth="1.5" strokeLinecap="round" opacity={animate ? 1 : 0.6}>
        <line x1="148" y1="80" x2="138" y2="72" className={animate ? "ma-spark" : undefined} />
        <line x1="148" y1="80" x2="160" y2="72" className={animate ? "ma-spark" : undefined} />
        <line x1="148" y1="80" x2="162" y2="84" className={animate ? "ma-spark" : undefined} />
      </g>
    </g>
  );
}

function Forklift({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="70" y="60" width="66" height="30" rx="4" fill={C.body} />
      <path d="M86 60 v-26 h34 l8 26" fill="none" stroke={C.steelDark} strokeWidth="3" />
      <rect x="120" y="70" width="18" height="20" fill={C.bodyDark} />
      <Wheel x={86} y={96} r={9} />
      <Wheel x={126} y={96} r={7} />
      <rect x="60" y="24" width="5" height="76" fill={C.steelDark} />
      <g className={animate ? "ma-fork" : undefined}>
        <rect x="30" y="86" width="34" height="4" fill={C.steelDark} />
        <rect x="32" y="74" width="28" height="12" fill="#c2410c" stroke={C.steelDark} strokeWidth="0.7" />
      </g>
    </g>
  );
}

function Generic({ animate }: { animate: boolean }) {
  return (
    <g>
      <Ground />
      <rect x="50" y="56" width="100" height="40" rx="6" fill={C.body} />
      <rect x="62" y="64" width="40" height="16" rx="2" fill={C.steelDark} />
      <circle cx="126" cy="72" r="9" fill={C.steelDark} className={animate ? "ma-spark" : undefined} />
      <Wheel x={70} y={98} />
      <Wheel x={130} y={98} />
    </g>
  );
}

const SCENES: Record<MachineKind, (props: { animate: boolean }) => React.ReactElement> = {
  crane: Crane,
  lift: Lift,
  truck: Truck,
  welder: Welder,
  forklift: Forklift,
  generic: Generic,
};

export function MachineArt({ kind, animate = true, className }: { kind: MachineKind; animate?: boolean; className?: string }) {
  const Scene = SCENES[kind];
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <style>{STYLE}</style>
      <Scene animate={animate} />
    </svg>
  );
}

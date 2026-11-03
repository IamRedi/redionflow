/**
 * Background for the Workzone board of a steel construction company: a calm
 * panorama of a steel frame under construction, a tower crane lifting a beam
 * and a truss bridge, in the company's steel and safety-orange colours. Drawn
 * low-contrast so the site cards stay readable on top. Pure SVG, no assets.
 */

type Palette = {
  skyTop: string;
  skyBottom: string;
  glow: string;
  glowOpacity: number;
  far: string;
  mid: string;
  steel: string;
  steelHi: string;
  orange: string;
  ground: string;
  groundTop: string;
  light: string;
};

const DARK: Palette = {
  skyTop: "#0c111b",
  skyBottom: "#1a2130",
  glow: "#f97316",
  glowOpacity: 0.22,
  far: "#1b2230",
  mid: "#242c3a",
  steel: "#3b4658",
  steelHi: "#64748b",
  orange: "#c2570f",
  ground: "#14171d",
  groundTop: "#1d222b",
  light: "#fdba74",
};

const LIGHT: Palette = {
  skyTop: "#dfe6ee",
  skyBottom: "#f3ede4",
  glow: "#fb923c",
  glowOpacity: 0.18,
  far: "#cdd4dd",
  mid: "#b8c1cc",
  steel: "#8794a6",
  steelHi: "#a9b4c3",
  orange: "#f2a06a",
  ground: "#e4e1db",
  groundTop: "#d6d2ca",
  light: "#fff7ed",
};

const GROUND = 470;

/** Steel frame: columns, floor beams, cross braces, the lower floor partly clad. */
function Frame({ p }: { p: Palette }) {
  const xs = [230, 310, 390, 470, 550, 630, 710];
  const floors = [410, 330, 250];
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <rect key={`clad-${i}`} x={xs[i]! + 5} y={414} width={70} height={GROUND - 414} fill={p.mid} opacity={0.9} />
      ))}
      {xs.map((x, i) => (
        <rect key={`col-${x}`} x={x - 4} y={i > 4 ? 330 : 250} width={8} height={GROUND - (i > 4 ? 330 : 250)} fill={p.steel} />
      ))}
      {floors.map((y, fi) => (
        <rect key={`beam-${y}`} x={226} y={y - 4} width={fi === 2 ? 332 : 488} height={8} fill={p.steel} />
      ))}
      {xs.slice(0, -1).map((x, i) =>
        i % 2 === 0 ? (
          <g key={`brace-${x}`} stroke={p.steelHi} strokeWidth={3} opacity={0.7}>
            <line x1={x} y1={410} x2={xs[i + 1]} y2={330} />
            <line x1={x} y1={330} x2={xs[i + 1]} y2={410} />
          </g>
        ) : null,
      )}
      <rect x={226} y={246} width={332} height={3} fill={p.steelHi} opacity={0.6} />
    </g>
  );
}

/** Tower crane with a beam on the hook. */
function Crane({ p }: { p: Palette }) {
  const mx = 860;
  const top = 118;
  const segs = Array.from({ length: 13 }, (_, i) => GROUND - i * 27);
  return (
    <g>
      <rect x={mx - 13} y={top} width={26} height={GROUND - top} fill="none" stroke={p.orange} strokeWidth={2} />
      {segs.map((y) => (
        <line key={y} x1={mx - 13} y1={y} x2={mx + 13} y2={y - 27} stroke={p.orange} strokeWidth={1.3} opacity={0.8} />
      ))}
      {/* jib and counter jib */}
      <rect x={560} y={top - 7} width={700} height={7} fill={p.orange} />
      <path d={`M ${mx} ${top - 50} L 600 ${top - 8} M ${mx} ${top - 50} L 1240 ${top - 8}`} stroke={p.orange} strokeWidth={1.6} fill="none" />
      <rect x={mx - 6} y={top - 56} width={12} height={50} fill={p.orange} />
      <rect x={1180} y={top + 2} width={46} height={28} fill={p.steel} />
      <rect x={mx + 14} y={top + 4} width={22} height={20} rx={3} fill={p.steel} />
      {/* trolley, cable and the beam being lifted */}
      <rect x={636} y={top + 2} width={18} height={8} fill={p.steel} />
      <line x1={645} y1={top + 10} x2={645} y2={196} stroke={p.steelHi} strokeWidth={2} />
      <path d="M 645 196 L 600 214 M 645 196 L 690 214" stroke={p.steelHi} strokeWidth={1.5} />
      <rect x={590} y={214} width={110} height={9} fill={p.steel} />
      <rect x={590} y={214} width={110} height={2} fill={p.steelHi} opacity={0.8} />
    </g>
  );
}

/** Truss bridge on two piers, running out of the picture. */
function Bridge({ p }: { p: Palette }) {
  const deck = 428;
  const topChord = 368;
  const xs = Array.from({ length: 10 }, (_, i) => 1150 + i * 52);
  return (
    <g>
      <rect x={1230} y={deck + 6} width={22} height={GROUND - deck - 6} fill={p.mid} />
      <rect x={1440} y={deck + 6} width={22} height={GROUND - deck - 6} fill={p.mid} />
      <rect x={1130} y={deck} width={480} height={7} fill={p.steel} />
      <rect x={1150} y={topChord - 3} width={460} height={6} fill={p.steel} />
      {xs.slice(0, -1).map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={i % 2 === 0 ? deck : topChord}
          x2={xs[i + 1]}
          y2={i % 2 === 0 ? topChord : deck}
          stroke={p.steelHi}
          strokeWidth={3}
        />
      ))}
      {xs.map((x) => (
        <line key={`v-${x}`} x1={x} y1={topChord} x2={x} y2={deck} stroke={p.steel} strokeWidth={2} opacity={0.7} />
      ))}
    </g>
  );
}

export function SteelSiteScene({ dark, className = "" }: { dark: boolean; className?: string }) {
  const p = dark ? DARK : LIGHT;
  const id = dark ? "ssd" : "ssl";
  return (
    <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="1" stopColor={p.skyBottom} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.68" cy="0.8" r="0.55">
          <stop offset="0" stopColor={p.glow} stopOpacity={p.glowOpacity} />
          <stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.groundTop} />
          <stop offset="1" stopColor={p.ground} />
        </linearGradient>
      </defs>
      <rect width="1600" height="600" fill={`url(#${id}-sky)`} />
      <rect width="1600" height="600" fill={`url(#${id}-glow)`} />
      {/* distant hills and town */}
      <path d="M0 418 C 180 380, 320 400, 470 384 S 820 360, 1010 392 S 1360 372, 1600 396 L1600 470 L0 470 Z" fill={p.far} />
      {[40, 110, 150, 960, 1010, 1060, 1090].map((x, i) => (
        <rect key={x} x={x} y={GROUND - 40 - ((i * 23) % 50)} width={i % 2 ? 34 : 46} height={40 + ((i * 23) % 50)} fill={p.mid} opacity={0.55} />
      ))}
      <Frame p={p} />
      <Bridge p={p} />
      <Crane p={p} />
      {/* yard: ground, a stack of beams, site lights */}
      <rect y={GROUND} width="1600" height={600 - GROUND} fill={`url(#${id}-ground)`} />
      <g fill={p.steel}>
        <rect x={60} y={GROUND - 10} width={130} height={10} />
        <rect x={72} y={GROUND - 20} width={110} height={10} opacity={0.85} />
        <rect x={86} y={GROUND - 30} width={84} height={10} opacity={0.7} />
      </g>
      {dark
        ? [250, 470, 690, 860, 1240, 1450].map((x) => <circle key={x} cx={x} cy={x === 860 ? 64 : GROUND - 2} r={2.2} fill={p.light} opacity={0.85} />)
        : null}
    </svg>
  );
}

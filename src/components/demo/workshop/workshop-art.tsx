import { assetArtKind } from "@/lib/workshop/identity-art";
import { MusterMark } from "./tree-art";
import styles from "./workshop.module.css";

function Wheels({ xs, y = 98 }: { xs: number[]; y?: number }) { return <g>{xs.map(x => <g key={x}><circle cx={x} cy={y} r="9" fill="var(--ink)" /><circle cx={x} cy={y} r="4" fill="var(--metal)" /></g>)}</g>; }
/** Same restrained SVG material language as the steel scenes, with Baumdienst tools. */
export function WorkshopAssetArt({ id: rawId, name = "", category = "tool", animate = false, className = "" }: { id: string; name?: string; category?: string; animate?: boolean; className?: string }) {
  const id = assetArtKind(rawId, name, category);
  const fleet = ["truck", "crane", "platform", "chipper"].includes(id);
  return <svg viewBox="0 0 220 125" aria-hidden="true" className={`${styles.art} ${className}`} fill="none">
    <ellipse cx="110" cy="111" rx="91" ry="6" fill="var(--ground)" />
    {fleet ? <><rect x="30" y="81" width="155" height="14" rx="4" fill="var(--metal)" /><Wheels xs={id === "chipper" ? [74, 134] : [51, 83, 171]} />
      {id !== "chipper" && <><path d="M147 82V49h28l20 22v16h-48Z" fill="currentColor" /><path d="M153 55h19l14 16h-33Z" fill="var(--glass)" /><path d="M153 77h8" stroke="var(--ink)" strokeWidth="2" /></>}
      {id === "truck" && <><rect x="29" y="48" width="112" height="35" rx="4" fill="currentColor" /><path d="M38 55v20m18-20v20m18-20v20m18-20v20m18-20v20m18-20v20" stroke="var(--glass)" opacity=".4" strokeWidth="2" /></>}
      {id === "chipper" && <><path d="M36 82V48q0-8 8-8h82q8 0 8 8v34Z" fill="currentColor" /><path d="m134 51 38-16v42l-38-8Z" fill="var(--metal)" /><path d="M68 40V23h38l16-10" stroke="var(--metal)" strokeWidth="10" strokeLinejoin="round" /><circle cx="73" cy="63" r="15" stroke="var(--glass)" strokeWidth="3" /><g className={animate ? styles.repair : ""}><path d="m63 63 10-10 10 10-10 10Z" fill="var(--glass)" /></g></>}
      {id === "crane" && <><rect x="38" y="62" width="95" height="20" rx="4" fill="currentColor" /><path d="M80 63 123 26h42" stroke="var(--metal)" strokeWidth="10" strokeLinejoin="round" /><path d="M165 27v29q0 9-7 9" stroke="var(--metal)" strokeWidth="3" /><path d="M40 93v15m90-15v15" stroke="var(--metal)" strokeWidth="5" /></>}
      {id === "platform" && <><path d="m54 80 50-36 33-8" stroke="currentColor" strokeWidth="11" strokeLinejoin="round" /><path d="m54 67 48-32 30-9" stroke="var(--metal)" strokeWidth="3" /><rect x="130" y="17" width="40" height="23" rx="3" fill="currentColor" /><path d="M135 17V8h29v9m-17-9v13" stroke="var(--metal)" strokeWidth="3" /></>}
    </> : <g className={animate ? styles.repair : ""}>
      {id === "toolbox" ? <><rect x="54" y="51" width="112" height="47" rx="8" fill="currentColor" /><path d="M87 51V36h46v15M54 68h112" stroke="var(--metal)" strokeWidth="6" /><rect x="103" y="62" width="14" height="15" rx="3" fill="var(--glass)" /></> : id === "helmet" ? <><path d="M62 85V68a48 48 0 0 1 96 0v17Z" fill="currentColor" /><path d="M53 87h114M110 23v46" stroke="var(--metal)" strokeWidth="8" strokeLinecap="round" /></> : id === "spade" ? <><path d="M101 21h19v15h-19zM110 36v40" stroke="var(--metal)" strokeWidth="7" /><path d="M86 72h48v17q-24 30-48 0Z" fill="currentColor" /></> : id === "trimmer" ? <><path d="m63 35 97 61M88 51l-15 16" stroke="var(--metal)" strokeWidth="8" strokeLinecap="round" /><rect x="42" y="22" width="39" height="32" rx="8" fill="currentColor" /><ellipse cx="160" cy="95" rx="27" ry="8" fill="currentColor" /></> : id === "saw" || id === "pole-saw" ? <><rect x={id === "saw" ? 95 : 42} y="61" width={id === "saw" ? 93 : 142} height="20" rx="10" fill="var(--metal)" /><path d="m105 57 78 0m-78 29h78" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 4" /><rect x="34" y="57" width="70" height="36" rx="9" fill="currentColor" /><path d="M45 57V43h30v14m22 8 12-18" stroke="var(--ink)" strokeWidth="7" strokeLinejoin="round" /><rect x="45" y="68" width="19" height="12" rx="3" fill="var(--glass)" /></> : id === "harness" ? <><path d="M69 32h75l-8 33 19 35h-36L105 78 90 100H54l20-35Z" fill="currentColor" /><path d="m75 34 30 44 32-44M69 60h75" stroke="var(--glass)" strokeWidth="7" /><rect x="96" y="59" width="18" height="17" rx="3" fill="var(--metal)" /></> : <><circle cx="81" cy="73" r="28" fill="currentColor" /><circle cx="81" cy="73" r="14" stroke="var(--glass)" strokeWidth="4" /><path d="m108 76 66 5 18 16-82-4Z" fill="var(--metal)" /><path d="M69 45V32h33v22" stroke="var(--ink)" strokeWidth="7" strokeLinejoin="round" /></>}
    </g>}
    <MusterMark x={188} y={22} />
  </svg>;
}
export function WorkshopScene({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 600 220" aria-hidden="true" className={`${styles.art} ${className}`} fill="none">
    <ellipse cx="300" cy="202" rx="270" ry="12" fill="var(--ground)" />
    <g className={styles.sway}><path d="M501 197V62" stroke="var(--metal)" strokeWidth="10" /><path d="m501 44-47 66h25l-38 54h120l-38-54h25Z" fill="currentColor" opacity=".4" /><path d="m542 72-30 49h18l-24 38h73l-24-38h17Z" fill="currentColor" opacity=".22" /></g>
    <path d="M58 193V68l144-44 159 44v125Z" fill="var(--ground)" stroke="var(--metal)" strokeWidth="2" />
    <path d="m46 70 156-48 173 48" stroke="var(--metal)" strokeWidth="7" strokeLinecap="round" />
    <rect x="83" y="90" width="186" height="103" rx="5" fill="var(--ink)" /><path d="M85 95h182m-182 9h182m-182 9h182" stroke="var(--metal)" strokeWidth="3" opacity=".6" />
    <rect x="289" y="104" width="44" height="89" rx="3" fill="currentColor" opacity=".6" /><rect x="298" y="115" width="26" height="31" rx="2" fill="var(--glass)" />
    <path d="M296 160h7" stroke="var(--glass)" strokeWidth="3" />
    <g transform="translate(103 106) scale(.74)"><WorkshopTruck /></g>
    <g transform="translate(390 138)"><rect y="21" width="81" height="8" rx="3" fill="var(--metal)" /><path d="M8 29v29m65-29v29" stroke="var(--metal)" strokeWidth="5" /><g className={styles.repair}><path d="m26 17 18-17m-6 2 8-3 3 8-7 4-6-4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></g><rect x="49" y="8" width="19" height="13" rx="3" fill="currentColor" /></g>
    <g stroke="var(--metal)" strokeWidth="3"><circle cx="362" cy="185" r="11" fill="var(--glass)" /><circle cx="384" cy="185" r="11" fill="var(--glass)" /><circle cx="373" cy="165" r="11" fill="var(--glass)" /></g>
  </svg>;
}
function WorkshopTruck() { return <g><rect x="1" y="53" width="169" height="28" rx="4" fill="currentColor" /><rect x="7" y="18" width="100" height="40" rx="3" fill="currentColor" /><path d="M113 56V22h29l24 28v17h-53Z" fill="var(--metal)" /><path d="M120 29h19l16 20h-35Z" fill="var(--glass)" /><Wheels xs={[28, 66, 144]} y={84} /></g>; }
export function BaumdienstSiteArt({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 400 170" aria-hidden="true" className={`${styles.art} ${className}`} fill="none"><path d="M0 143q90-26 192-3t208-4v34H0Z" fill="var(--ground)" /><g opacity=".25" fill="currentColor"><circle cx="38" cy="51" r="29" /><circle cx="363" cy="62" r="37" /></g><g className={styles.sway}><path d="M104 146V58m0 39L77 72m27 11 25-27" stroke="var(--metal)" strokeWidth="7" strokeLinecap="round" /><path d="M53 51q0-32 32-28 17-27 40-7 36-4 38 30 26 30-6 49-16 15-42 4-37 17-53-7-34-7-9-41Z" fill="currentColor" opacity=".65" /></g><path d="M303 146V75" stroke="var(--metal)" strokeWidth="6" /><path d="m302 20-40 57h20l-30 38h103l-31-38h20Z" fill="currentColor" opacity=".38" /><g transform="translate(162 83) scale(.6)"><WorkshopTruck /></g><g stroke="var(--metal)" strokeWidth="2"><circle cx="340" cy="141" r="8" fill="var(--glass)" /><circle cx="356" cy="141" r="8" fill="var(--glass)" /><circle cx="348" cy="126" r="8" fill="var(--glass)" /></g></svg>;
}

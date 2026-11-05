import { treeArtKind } from "@/lib/workshop/identity-art";
import styles from "./workshop.module.css";

export function MusterMark({ x = 83, y = 82 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r="10" fill="var(--ink)" stroke="var(--glass)" strokeWidth="1.2" /><path d="M-5 2C-5-5 0-6 5-5 6 1 1 6-4 4M-4 4 3-3" fill="none" stroke="var(--glass)" strokeWidth="1.6" strokeLinecap="round" /></g>;
}
/** Original species silhouettes, sharing the workshop material and company seal. */
export function TreeArt({ species, className = "" }: { species: string; className?: string }) {
  const kind = treeArtKind(species);
  const crown = kind === "oak" ? "M24 58C10 57 12 40 23 36 16 22 31 13 42 20 48 6 66 9 71 21 89 14 102 28 94 40 109 51 97 65 84 62 73 76 54 72 48 68 34 75 20 69 24 58Z" : kind === "maple" ? "m60 12 9 17 16-8-2 18 18 1-11 14 10 12-22 3-6 13-12-9-13 9-7-13-22-3 10-12-11-14 18-1-2-18 16 8Z" : kind === "lime" ? "M60 29C48 9 24 12 20 33 15 52 36 66 60 80 84 66 105 52 100 33 96 12 72 9 60 29Z" : kind === "beech" ? "M60 12C26 12 16 37 23 57 29 77 86 78 96 56 104 35 90 12 60 12Z" : kind === "willow" ? "M18 74C10 33 30 13 60 14 93 15 109 41 102 77L89 61 87 81 75 63 66 82 54 65 40 82 34 62 23 78Z" : "M22 57C12 42 23 26 37 29 42 11 65 10 76 24 95 23 107 39 96 55 103 75 78 81 61 74 45 84 20 75 22 57Z";
  return <svg viewBox="0 0 120 108" className={`${styles.art} ${className}`} fill="none" aria-hidden="true">
    <ellipse cx="60" cy="98" rx="40" ry="5" fill="var(--ground)" />
    {kind === "conifer" ? <><path d="M60 10 35 42h12L23 70h18L18 89h84L79 70h18L73 42h12Z" fill="currentColor" /><path d="m60 10 2 80h40L79 70h18L73 42h12Z" fill="var(--ink)" opacity=".2" /><path d="M60 66v30" stroke="var(--metal)" strokeWidth="6" /></> : <>
      {kind === "ash" ? <g fill="currentColor">{[0,1,2].map(i => <g key={i}><ellipse cx={42-i*4} cy={27+i*16} rx="17" ry="10" transform={`rotate(28 ${42-i*4} ${27+i*16})`} /><ellipse cx={78+i*4} cy={27+i*16} rx="17" ry="10" transform={`rotate(-28 ${78+i*4} ${27+i*16})`} /></g>)}<ellipse cx="60" cy="19" rx="11" ry="14" /></g> : <><path d={crown} fill="currentColor" /><path d={crown} fill="var(--glass)" opacity={kind === "birch" ? ".26" : ".1"} /><path d="M28 38q5-13 20-13m22 5q12-2 18 9" stroke="var(--glass)" strokeWidth="3" strokeLinecap="round" opacity=".55" /></>}
      <path d="M60 96V42m0 23L42 47m18 12 17-17" stroke={kind === "birch" ? "var(--glass)" : "var(--metal)"} strokeWidth={kind === "birch" ? 6 : 5} strokeLinecap="round" />
      {kind === "birch" && <path d="M57 75h5m-5 10h5m-5-20h5" stroke="var(--ink)" strokeWidth="2" />}
      {kind === "fruit" && <g fill="var(--glass)"><circle cx="37" cy="48" r="4" /><circle cx="81" cy="42" r="4" /><circle cx="72" cy="66" r="4" /></g>}
    </>}
    <path d="m49 97 11-5 11 5" stroke="var(--metal)" strokeWidth="3" strokeLinecap="round" />
    <MusterMark x={93} y={88} />
  </svg>;
}

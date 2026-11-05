"use client";

import { useId } from "react";
import { botanicalIdentity, botanicalPalette, type BotanicalKind, type BotanicalSeason } from "@/lib/workshop/botanical";
import styles from "./workshop.module.css";

export function MusterMark({ x = 83, y = 82 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r="10" fill="var(--ink)" stroke="var(--glass)" strokeWidth="1.2" /><path d="M-5 2C-5-5 0-6 5-5 6 1 1 6-4 4M-4 4 3-3" fill="none" stroke="var(--glass)" strokeWidth="1.6" strokeLinecap="round" /></g>;
}

function LeafShape({ kind, fill, vein }: { kind: BotanicalKind; fill: string; vein: string }) {
  if (["spruce","fir","yew","pine","thuja"].includes(kind)) return <g strokeLinecap="round"><path d="M37 90 42 14" stroke="#886947" strokeWidth="3" />{kind === "pine" ? [0,1,2,3].map(i => <g key={i} stroke={fill} strokeWidth="2.3"><path d={`M${39-i} ${78-i*12}Q${8+i*3} 38 ${14+i*6} 8`} /><path d={`M${39-i} ${78-i*12}Q${58+i*2} 38 ${65-i*4} 8`} /></g>) : Array.from({length:kind === "thuja" ? 8 : 12},(_,i) => <g key={i} stroke={fill} strokeWidth={kind === "thuja" ? 5.5 : 3}><path d={`M${40-i*.25} ${22+i*5}l${-14-(i%3)*3} ${kind === "spruce" ? -10 : -3}`} /><path d={`M${40-i*.25} ${22+i*5}l${15+(i%3)*2} ${kind === "spruce" ? -10 : -3}`} />{kind === "thuja" && <path d={`M${26-i*.25} ${19+i*5}l-4-9m${31-i*.25} 9 4-9`} strokeWidth="3" />}</g>)}</g>;
  if (kind === "ash" || kind === "rowan") return <g><path d="M40 92V12" stroke={vein} strokeWidth="2" />{[0,1,2,3].map(i => <g key={i} fill={fill}><path d={`M39 ${28+i*14}Q${7-i%2*3} ${30+i*14} 12 ${9+i*14}Q36 ${10+i*14} 39 ${28+i*14}Z`} /><path d={`M41 ${28+i*14}Q${73+i%2*3} ${30+i*14} 68 ${9+i*14}Q44 ${10+i*14} 41 ${28+i*14}Z`} /></g>)}<path d="M40 23Q25 11 40 2 55 11 40 23Z" fill={fill} /></g>;
  if (kind === "chestnut") return <g fill={fill}><path d="M40 92V64" stroke={vein} strokeWidth="2" />{[-65,-33,0,33,65].map((a,i) => <g key={a} transform={`rotate(${a} 40 67)`}><path d={`M40 67Q${13+i%2*3} 36 40 ${i===2 ? 1 : 12}Q${67-i%2*3} 36 40 67Z`} /><path d={`M40 65V${i===2 ? 5 : 16}`} stroke={vein} strokeWidth=".8" /></g>)}</g>;
  const paths: Partial<Record<BotanicalKind,string>> = {
    oak:"M38 85C25 84 16 76 24 68 6 68 7 54 22 53 6 43 11 31 26 34 17 19 27 12 35 19 35 3 46 2 49 19 64 10 71 24 59 34 76 29 82 43 66 51 81 55 76 69 61 68 69 79 55 87 43 85Z",
    maple:"m40 5 8 23 12-11-2 22 18-3-12 19 13 6-23 9 2 13-15-7-15 7 2-13L5 61l13-6L6 36l18 3-2-22 12 11Z",
    plane:"m40 5 10 25 18-13-3 24 15 5-18 18 4 15-24-6-23 6 4-15L5 46l15-5-3-24 18 13Z",
    birch:"m40 8 7 11 3 5 8 7-1 5 8 8-2 5 7 8-5 6-2 5-9 5-2 5-13 8-13-8-2-5-9-5-2-5-5-6 7-8-2-5 8-8-1-5 8-7 3-5Z",
    lime:"M40 19C23 1 4 14 7 34 8 56 22 65 40 83 59 66 75 54 75 34 78 13 57 0 40 19Z",
    willow:"M39 85Q9 53 43 4 65 44 39 85Z",
    beech:"M40 7C26 11 18 20 16 30 9 39 17 46 14 53 14 66 27 79 40 84 55 77 68 65 66 53 72 44 65 38 66 30 64 20 54 11 40 7Z",
    hornbeam:"m40 7 7 7 7 3 1 7 7 4-1 7 6 6-4 7 2 8-7 4-1 8-9 4-8 10-8-10-9-4-1-8-7-4 2-8-4-7 6-6-1-7 7-4 1-7 7-3Z",
    ginkgo:"M37 85 34 62C17 60 6 50 6 34L11 22l7-2 6-11 8 5 7-4 3 14 5-14 7 4 8-5 6 11 7 2 5 12C77 51 61 60 46 62l-3 23Z",
    box:"M40 22C16 15 10 42 21 58 29 69 38 73 40 77 45 70 58 68 63 52 69 30 58 16 40 22Z",
  };
  return <g><path d={paths[kind] || "M40 7C14 17 7 43 20 62 26 74 34 79 40 85 49 76 58 73 64 58 75 36 61 17 40 7Z"} fill={fill} stroke={fill} strokeWidth=".7" /><path d="M40 93V19" stroke={vein} strokeWidth="1.6" strokeLinecap="round" />{kind === "maple" || kind === "plane" ? <path d="m40 72-22-24m22 24L62 48M40 66 28 32m12 34 12-34" stroke={vein} strokeWidth=".9" fill="none" /> : kind === "ginkgo" ? <path d="M40 80 15 28m25 52L26 17m14 63 16-63m-16 63L68 28" stroke={vein} strokeWidth=".8" fill="none" /> : [0,1,2,3,4].map(i => <path key={i} d={`M40 ${35+i*9}l${-13-i%2*4}-11m${13+i%2*4} 11 ${13+i%2*4}-11`} stroke={vein} strokeWidth=".8" opacity=".8" />)}</g>;
}

export function LeafArt({ species, season="summer", className="" }: { species: string; season?: BotanicalSeason; className?: string }) {
  const {kind,known} = botanicalIdentity(species), p=botanicalPalette(species,season);
  return <svg viewBox="0 0 80 100" className={className} fill="none" aria-hidden="true">{known ? <LeafShape kind={kind} fill={p.leaf} vein={p.vein} /> : <path d="M40 86V50m0 0C10 49 12 17 40 10 68 17 70 49 40 50" stroke={p.mid} strokeWidth="2" strokeDasharray="4 4" />}</svg>;
}

const fullCrown = [[44,46,20,17,-18],[65,33,23,21,0],[86,43,24,20,18],[29,61,20,17,-10],[53,61,25,22,10],[81,65,25,22,-10],[103,61,17,18,0],[37,79,19,15,-15],[62,79,23,16,10],[89,81,21,15,-10]];
/** Original botanical plates: crown structure, tapered branches, leaf inset and seasonal palette. */
export function TreeArt({ species, season="summer", className="" }: { species: string; season?: BotanicalSeason; className?: string }) {
  const id = useId().replace(/:/g,""), identity=botanicalIdentity(species), {kind,hedge}=identity, p=botanicalPalette(species,season);
  const conifer=["spruce","fir","thuja","yew"].includes(kind), birch=kind === "birch", willow=kind === "willow", pine=kind === "pine";
  const clusters = birch ? [[54,28,14,21,-10],[68,46,21,28,12],[42,56,15,27,-5],[77,70,20,21,10],[50,77,20,18,-8]] : willow ? [[32,66,18,31,-10],[56,48,24,28,0],[81,55,25,31,8],[99,78,14,31,12],[55,79,30,24,0]] : fullCrown;
  return <svg viewBox="0 0 180 150" className={`${styles.art} ${className}`} fill="none" aria-hidden="true" data-botanical-kind={kind} data-botanical-form={hedge ? "hedge" : "tree"}>
    <defs><linearGradient id={`${id}-c`} x1="20" y1="20" x2="103" y2="103" gradientUnits="userSpaceOnUse"><stop stopColor={p.light} /><stop offset=".45" stopColor={p.mid} /><stop offset="1" stopColor={p.deep} /></linearGradient><linearGradient id={`${id}-b`}><stop stopColor={birch ? "#e1ddd0" : "#a58a68"} /><stop offset=".45" stopColor={birch ? "#f6f2e5" : "#7b6348"} /><stop offset="1" stopColor={birch ? "#aaa99a" : "#4a4436"} /></linearGradient><radialGradient id={`${id}-s`}><stop stopColor="#657254" stopOpacity=".25" /><stop offset="1" stopColor="#657254" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="67" cy="136" rx="59" ry="8" fill={`url(#${id}-s)`} />
    <g strokeLinecap="round" strokeLinejoin="round">
      {!hedge && <><path d={birch ? "M58 133 63 52 69 32 67 82 65 132Z" : "M54 134 59 104 61 67 67 39 68 101 73 134Z"} fill={`url(#${id}-b)`} /><path d="M63 105 39 66m25 25 26-35m-27 24L48 44m18 26 11-36" stroke={birch ? "#c9c9b5" : "#705d45"} strokeWidth="3" /><path d="m55 135 9-6 12 6" stroke="#806c4d" strokeWidth="2.5" /></>}
      {hedge ? <><path d="M14 120 17 63Q21 55 31 57L99 55Q109 56 113 64L117 121Z" fill={`url(#${id}-c)`} /><path d="m14 120 9-7 85-2 9 10Z" fill={p.deep} opacity=".6" />{Array.from({length:28},(_,i)=><ellipse key={i} cx={23+(i%7)*13} cy={66+Math.floor(i/7)*14} rx={7+i%3} ry={5+i%2} transform={`rotate(${i%2 ? -28 : 22} ${23+(i%7)*13} ${66+Math.floor(i/7)*14})`} fill={i%4===0 ? p.light : i%3===0 ? p.deep : p.mid} opacity=".68" />)}<path d="M19 61q43-6 87 0" stroke={p.light} opacity=".65" strokeWidth="2" /></> : conifer ? <g>{[0,1,2,3,4,5].map(i=><g key={i}><path d={`M66 ${13+i*15}Q${53-i*6} ${31+i*15} ${49-i*6} ${43+i*14}Q65 ${36+i*15} ${83+i*6} ${43+i*14}Q${79+i*6} ${31+i*15} 66 ${13+i*15}Z`} fill={`url(#${id}-c)`} /><path d={`M66 ${22+i*15} ${53-i*5} ${39+i*14}m13 -17 ${13+i*5} 17`} stroke={p.light} strokeWidth="1" opacity=".5" /></g>)}</g> : pine ? <><path d="M65 105 57 65 31 45m32 37 31-31m-34 19 5-36" stroke="#806748" strokeWidth="5" />{[[28,45,22,11],[60,32,25,12],[91,47,25,13],[52,62,28,12]].map(([x,y,rx,ry],i)=><ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${id}-c)`} />)}</> : <g>{clusters.map(([x,y,rx,ry,a],i)=><g key={i}><ellipse cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${a} ${x} ${y})`} fill={`url(#${id}-c)`} /><path d={`M${x-rx*.6} ${y-ry*.2}q${rx*.5} ${-ry*.8} ${rx*1.1} ${-ry*.25}`} stroke={i%2 ? p.mid : p.light} opacity=".65" strokeWidth="3" /></g>)}{Array.from({length:22},(_,i)=><ellipse key={i} cx={30+(i*23)%66} cy={29+(i*17)%57} rx={2.4+i%3} ry={1.5+i%2} fill={i%3 ? p.light : p.deep} opacity=".42" transform={`rotate(${i*31} ${30+(i*23)%66} ${29+(i*17)%57})`} />)}{willow && [25,37,86,99].map((x,i)=><path key={x} d={`M${x} ${43+i%2*7}q-10 25 -4 52`} stroke={p.light} opacity=".65" strokeWidth="1.5" />)}{kind === "fruit" && <g fill="#c98154"><circle cx="32" cy="65" r="2.5" /><circle cx="78" cy="40" r="2.5" /><circle cx="91" cy="78" r="2.5" /></g>}</g>}
      {birch && <path d="m61 112 5-1m-4-12 4 1m-3-14 3 1" stroke="#635f4c" strokeWidth="1.8" />}
    </g>
    <circle cx="143" cy="103" r="29" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
    <g transform="translate(121 75) scale(.55)">{identity.known ? <LeafShape kind={kind} fill={p.leaf} vein={p.vein} /> : <path d="M40 90V46m0 0C9 45 15 12 40 8 65 12 71 45 40 46" stroke={p.mid} strokeWidth="2" strokeDasharray="4 4" />}</g>
    <MusterMark x={162} y={130} />
  </svg>;
}

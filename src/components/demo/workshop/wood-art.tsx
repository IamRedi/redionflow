import type { WoodIcon } from "@/lib/workshop/wood-model";
/** Native SVG geometry; matches the restrained stroked Baumdienst icon family. */
export function WoodIconArt({kind,className="size-6"}:{kind:WoodIcon;className?:string}){
  const paths:Record<WoodIcon,React.ReactNode>={
    logs:<><path d="M6 8h13a4 4 0 0 1 0 8H6"/><ellipse cx="6" cy="12" rx="4" ry="4"/><ellipse cx="6" cy="12" rx="1.4" ry="1.4"/><path d="M12 8v2m3 6v-2m4-6v2"/></>,
    cut:<><path d="M3 17 15 5l6 6-3 3-2-1-1 3-3-1-1 3-3-1-2 3Z"/><path d="m14 7 4 4"/></>,
    split:<><path d="m14 3 6 5-4 4-6-5Zm-1 7L4 21"/><path d="m15 15 5 5M15 20l2-2m-9-4-5-3"/></>,
    dry:<><circle cx="17" cy="6" r="3"/><path d="M17 1v1m0 8v1M12 6h-1m12 0h-1M3 19h18M5 16l3-5 3 5m3 0 3-5 3 5"/></>,
    pack:<><path d="m3 7 9-4 9 4v12l-9 3-9-3Zm0 0 9 4 9-4M12 11v11M8 5l9 4v6"/></>,
    truck:<><path d="M2 6h12v12H2Zm12 4h4l4 5v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    tree:<><path d="m12 2-6 7h3l-5 6h5l-4 4h14l-4-4h5l-5-6h3ZM12 19v4"/></>,
    shield:<><path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/><path d="m8 12 3 3 5-6"/></>,
    leaf:<><path d="M20 3C8 1 2 8 5 15s16 6 15-12ZM4 21 16 8M8 17l-1-6m5 3 5 1"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[kind]}</svg>;
}
export const woodArtUrl=(id:string)=>`/api/demo/baumdienst/wood/art/${encodeURIComponent(id)}?v=1`;

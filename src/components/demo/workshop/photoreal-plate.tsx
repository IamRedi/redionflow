"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { studioMediaUrl, type StudioMediaId } from "@/lib/workshop/studio-media";
import type { BotanicalSeason } from "@/lib/workshop/botanical";

export function PhotorealPlate({ id, season = "summer", leaf = false, overview = false, large = false, className = "", label = "" }: { id: StudioMediaId; season?: BotanicalSeason; leaf?: boolean; overview?: boolean; large?: boolean; className?: string; label?: string }) {
  const [failed, setFailed] = useState(false), [visible, setVisible] = useState(false);
  const clip = `reference-${useId().replace(/:/g, "")}`;
  const frame = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "160px" });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const column = leaf || season === "autumn" ? 1 : 0, row = leaf || season === "winter" ? 1 : 0;
  const crop = overview ? [0, 0, 1536, 1024] : [column * 768, row * 512, 768, 512];
  return <span ref={frame} className={`baum-photoreal-plate ${className}`} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} data-reference-kind="generated-species" data-reference-season={leaf ? "leaf" : season} data-reference-id={id}>
    {failed ? <Leaf className="baum-photoreal-fallback" /> : <svg viewBox={crop.join(" ")} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><clipPath id={clip} clipPathUnits="userSpaceOnUse"><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]} /></clipPath></defs>{visible && <image clipPath={`url(#${clip})`} href={studioMediaUrl(id, { variant: "photoreal-v2", size: large ? "large" : "card" })} width="1536" height="1024" onError={() => setFailed(true)} />}</svg>}
  </span>;
}

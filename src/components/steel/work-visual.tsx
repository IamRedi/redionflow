"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { SteelWorkPhoto } from "@/components/steel/work-photo";
import { steelWorkLabel } from "@/components/steel/work-catalog-label";
import type { SteelWorkDefinitionView } from "@/lib/steel-work/types";

export type SteelWorkVisualDefinition = Pick<SteelWorkDefinitionView, "kind" | "key" | "label"> &
  Partial<Pick<SteelWorkDefinitionView, "id" | "visualUpdatedAt" | "description" | "linkedProcessKey">>;

export function steelWorkVisualUrl(definition: Pick<SteelWorkVisualDefinition, "id" | "visualUpdatedAt">) {
  return definition.id && definition.visualUpdatedAt ? `/api/steel-work-visuals/${definition.id}?v=${new Date(definition.visualUpdatedAt).getTime()}` : null;
}

/** One source for saved photos/generated visuals and the photographic fallback. */
export function SteelWorkVisual({ definition, fallback, src, className = "h-full w-full", imageClassName }: {
  definition?: SteelWorkVisualDefinition | null; fallback?: string; src?: string | null; animate?: boolean; className?: string; imageClassName?: string;
}) {
  const url = src ?? (definition ? steelWorkVisualUrl(definition) : null);
  const { currentLang } = useLanguage();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`relative isolate overflow-hidden ${className}`} data-steel-work-visual>
    {url && failedUrl !== url ? <img src={url} alt={definition ? steelWorkLabel(definition, currentLang) : ""} onError={() => setFailedUrl(url)} className={imageClassName ?? "h-full w-full object-cover"} /> : <SteelWorkPhoto definition={definition} fallback={fallback} />}
  </div>;
}

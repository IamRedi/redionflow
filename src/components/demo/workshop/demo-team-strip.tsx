"use client";

import { WorkerIconStrip } from "@/app/(workzone)/workzone/worker-icon-strip";
import { useWorkshopDemo } from "./use-workshop-demo";

type Workers = React.ComponentProps<typeof WorkerIconStrip>["workers"];
/** Reuse the original staff strip, with links constrained to fictional demo profiles. */
export function DemoTeamStrip({ workers }: { workers: Workers }) {
  const { actor } = useWorkshopDemo();
  return <div className="min-w-0" data-testid="baum-team-strip"><WorkerIconStrip workers={workers} comfortable admin={actor.role === "admin"} profileHrefBase="/demo/workers" insetClassName="pl-1 pr-14" /></div>;
}

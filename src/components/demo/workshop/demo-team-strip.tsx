"use client";
import { WorkerIconStrip } from "@/app/(workzone)/workzone/worker-icon-strip";
import { useWorkshopDemo } from "./use-workshop-demo";
type Workers = React.ComponentProps<typeof WorkerIconStrip>["workers"];

/** The active worker's avatar opens their own existing profile directly. */
export function DemoTeamStrip({ workers }: { workers: Workers }) {
  const { actor, directory } = useWorkshopDemo();
  const ownId = directory.workers.find(worker=>worker.key===actor.key)?.id;
  const ordered=[...workers].sort((a,b)=>Number(b.id===ownId)-Number(a.id===ownId));
  return <div className="min-w-0" data-testid="baum-team-strip"><WorkerIconStrip workers={ordered.map(worker=>({...worker,activeProfile:worker.id===ownId}))} comfortable admin={actor.role === "admin"} profileHrefBase="/demo/workers" insetClassName="pl-[64px] pr-2" /></div>;
}

import { cookies } from "next/headers";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { demoOffice, type DemoActor } from "./custody-schema";
import type { WorkshopDirectory, WorkshopSnapshot } from "./shared-contract";

export const DEMO_ACTOR_COOKIE = "bdf_demo_actor";
/** Role switching is a labelled fictional simulation, never an operational login. */
export async function currentDemoActor(directory: WorkshopDirectory): Promise<DemoActor> {
  const claims = readSessionCookie((await cookies()).get(DEMO_ACTOR_COOKIE)?.value, "display");
  const key = claims?.id.startsWith("bdf-demo:") ? claims.id.slice(9) : "admin";
  const worker = directory.workers.find(w => w.key === key);
  return worker ? { key: worker.key, name: worker.name, role: "worker" } : demoOffice;
}
export async function withDemoActor(snapshot: WorkshopSnapshot) { return { ...snapshot, actor: await currentDemoActor(snapshot.directory) }; }

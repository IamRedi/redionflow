import { AsyncLocalStorage } from 'node:async_hooks';
type RealtimeSubscriber = (payload: string) => void;
const batches = new AsyncLocalStorage<{companyId:string;events:Set<string>;scopes:Set<string>}>();

/**
 * T-034 — Per-tenant realtime channels.
 *
 * Subscribers register with an optional `companyProfileId`. Publishers may
 * also include one:
 *   - `notifyRealtimeUpdate(event, scope)`                 → broadcast to all
 *   - `notifyRealtimeUpdate(event, scope, companyId)`     → only tenant subs
 *
 * When a subscriber registers with a tenant id, it only receives events
 * that either target its tenant or that were published without a tenant
 * scope (system-wide notifications). This mirrors how Supabase Realtime
 * scopes channels and is a strict superset of the previous global-only
 * behaviour.
 *
 * Subscribers without a tenant id (legacy callers) still receive every
 * event, so the migration can be incremental. New surfaces should always
 * pass the tenant id.
 */

type SubscriberEntry = {
  fn: RealtimeSubscriber;
  companyProfileId?: string;
};

const subscribers = new Set<SubscriberEntry>();

export function subscribeRealtimeUpdates(
  subscriber: RealtimeSubscriber,
  options?: { companyProfileId?: string },
): () => void {
  const entry: SubscriberEntry = { fn: subscriber, companyProfileId: options?.companyProfileId };
  subscribers.add(entry);
  return () => subscribers.delete(entry);
}

export function notifyRealtimeUpdate(
  event: string,
  scope: string[],
  companyProfileId?: string,
): void {
  const batch=batches.getStore();
  if(batch&&(!companyProfileId||batch.companyId===companyProfileId)){
    batch.events.add(event);scope.forEach(value=>batch.scopes.add(value));return;
  }
  publish(event,scope,companyProfileId);
}

/** Request-local only: one UI refresh for a group, including partial commits.
 * Existing individual actions and unrelated concurrent requests stay immediate. */
export async function withRealtimeBatch<T>(companyId:string,run:()=>Promise<T>):Promise<T>{
  if(batches.getStore()?.companyId===companyId)return run();
  const batch={companyId,events:new Set<string>(),scopes:new Set<string>()};
  return batches.run(batch,async()=>{
    try{return await run();}
    finally{if(batch.scopes.size)publish(batch.events.size===1?[...batch.events][0]:'batch.updated',[...batch.scopes],companyId);}
  });
}

function publish(event:string,scope:string[],companyProfileId?:string):void{
  const payload = JSON.stringify({ event, scope, companyProfileId });
  for (const entry of subscribers) {
    // Subscribers without a tenant id receive everything (legacy behaviour).
    // Tenant-scoped subscribers only receive events for their tenant or
    // events without a tenant id (system-wide broadcasts).
    if (
      entry.companyProfileId &&
      companyProfileId &&
      entry.companyProfileId !== companyProfileId
    ) {
      continue;
    }
    try {
      entry.fn(payload);
    } catch {
      // Ignore individual subscriber failures to keep broadcast stable.
    }
  }
}

import { z } from "zod";
import { actorSchema } from "./custody-schema";

export const DEMO_BRAND_TARGET = "brand-musterfirma";
export const mediaTargetSchema = z.object({ kind: z.enum(["asset", "site", "phase", "job", "intake"]), target: z.string().min(1).max(128), jobId: z.string().min(1).max(128).optional() }).strict();
export type MediaTarget = z.infer<typeof mediaTargetSchema>;
export const mediaKey = (target: MediaTarget) => JSON.stringify([target.kind, target.target, target.jobId ?? ""]);
export const mediaPreferenceSchema = z.object({ key: z.string().max(300), hidden: z.array(z.string().max(200)).max(200), cover: z.string().max(200).optional() });
export type MediaPreference = z.infer<typeof mediaPreferenceSchema>;
export const mediaStateSchema = z.object({ version: z.literal(1), preferences: z.array(mediaPreferenceSchema).max(500), events: z.array(z.object({ id: z.uuid(), key: z.string().max(300), mediaId: z.string().max(200), action: z.enum(["remove", "restore", "cover"]), at: z.iso.datetime(), actor: actorSchema })).max(2000) });
export const emptyMediaState = () => ({ version: 1 as const, preferences: [], events: [] });
export const mediaCommandSchema = mediaTargetSchema.extend({ action: z.enum(["remove", "restore", "cover"]), mediaId: z.string().min(1).max(200) }).strict();
export const mediaEnvelope = z.object({ requestId: z.uuid(), revision: z.number().int().nonnegative(), command: mediaCommandSchema }).strict();
export type MediaCommand = z.infer<typeof mediaCommandSchema>;
export function mediaPreference(preferences: MediaPreference[] | undefined, target: MediaTarget) { return preferences?.find(p => p.key === mediaKey(target)); }
export function mediaVisible(preference: MediaPreference | undefined, id: string) { return !preference?.hidden.includes(id); }
export function orderMedia<T extends { id: string }>(items: T[], preference: MediaPreference | undefined) {
  return items.filter(p => mediaVisible(preference, p.id)).sort((a,b) => Number(b.id === preference?.cover) - Number(a.id === preference?.cover));
}
/** Only presentation references change. Original bytes, inventory and work records stay intact. */
export function applyMediaPreference(input: z.infer<typeof mediaStateSchema>, command: MediaCommand, actor: z.infer<typeof actorSchema>, at: string, id: string) {
  const state = structuredClone(input), key = mediaKey(command);
  let preference = state.preferences.find(p => p.key === key);
  if (!preference) { preference = { key, hidden: [] }; state.preferences.push(preference); }
  if (command.action === "remove") { if (!preference.hidden.includes(command.mediaId)) preference.hidden.push(command.mediaId); if (preference.cover === command.mediaId) delete preference.cover; }
  else { preference.hidden = preference.hidden.filter(id => id !== command.mediaId); if (command.action === "cover") preference.cover = command.mediaId; }
  state.events.unshift({ id, key, mediaId: command.mediaId, action: command.action, at, actor });
  return mediaStateSchema.parse(state);
}

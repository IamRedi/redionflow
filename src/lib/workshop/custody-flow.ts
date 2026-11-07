import { assetPlate, identityCollision, normalizeIdentity } from "./asset-identity";
import { applyWorkshopCommand, activeJob, availability, workshopSchema, WorkshopError, type WorkshopState, type WorkshopAsset, type InventoryPlacement } from "./demo-model";
import { treeUpdateSchema, type DemoActor, type Handover } from "./custody-schema";
import type { publicWorkshopCommand, WorkshopDirectory } from "./shared-contract";
import type { z } from "zod";

type Command = z.infer<typeof publicWorkshopCommand>;
function assert(value: unknown, code = "unavailable"): asserts value { if (!value) throw new WorkshopError(code); }
import { treeIdentity } from "./identity-art";
export { treeIdentity } from "./identity-art";
export type BaseTree = { status: string; species: string | null; diameter: number | null; note: string };

export function applyCustodyCommand(input: WorkshopState, command: Command, actor: DemoActor, directory: WorkshopDirectory, now: string, id: string, baseTree?: BaseTree): WorkshopState {
  let state = structuredClone(input);
  const assetFor = (key: string) => { const asset = state.assets.find(a => a.id === key); assert(asset, "missing"); return asset; };
  const pendingFor = (key: string) => state.custody.handovers.find(h => h.assetId === key && h.status === "pending");
  const event = (asset: WorkshopAsset, kind: WorkshopAsset["events"][number]["kind"], note = "", ref?: string, method?: "scan" | "selection", placement = asset.placement) => asset.events.unshift({ id, kind, at: now, note, actor: actor.name, actorKey: actor.key, ...(ref ? { ref } : {}), ...(method ? { method } : {}), ...(placement ? { placement: structuredClone(placement) } : {}) });
  const notify = (h: Handover, kind: "requested" | "confirmed" | "completed" | "declined" | "cancelled", recipients = [...new Set(["admin", ...h.required, h.createdBy.key])]) => recipients.forEach(recipient => state.custody.notifications.unshift({ id: `${id}-${state.custody.notifications.length}`, recipient, assetId: h.assetId, handoverId: h.id, kind, at: now }));
  const placement = (workerKey?: string, siteKey?: string): InventoryPlacement => {
    const w = directory.workers.find(w => w.key === workerKey && w.available), s = siteKey ? directory.sites.find(s => s.key === siteKey && s.active) : undefined;
    assert(w && (!siteKey || s));
    return { workerKey: w.key, workerName: w.name, ...(s ? { siteKey: s.key, siteName: s.name } : {}) };
  };
  function complete(h: Handover) {
    if (h.required.some(k => !h.confirmations.some(c => c.actorKey === k))) return;
    const asset = assetFor(h.assetId);
    assert(JSON.stringify(asset.placement) === JSON.stringify(h.from) && asset.holder === h.fromHolder);
    assert(!activeJob(state, asset.id) && (h.kind === "return" || availability(state, asset, now) !== "inspection"));
    if (h.to) h.to = placement(h.to.workerKey, h.to.siteKey);
    h.status = "completed"; h.updatedAt = now;
    const from = [h.from?.workerName, h.from?.siteName].filter(Boolean).join(" · ");
    if (h.kind === "return") { asset.holder = ""; delete asset.placement; asset.location = "Lager"; event(asset, "returned", from, h.id, h.method, h.from); }
    else { asset.placement = structuredClone(h.to!); asset.holder = h.to!.workerName!; asset.location = h.to!.siteName || asset.holder; event(asset, h.kind === "transfer" ? "transferred" : "issued", `${from ? `${from} → ` : ""}${[h.to!.workerName, h.to!.siteName].filter(Boolean).join(" · ")}${h.automatic ? " · AUTO" : ""}`, h.id, h.method); }
    notify(h, "completed");
  }
  const c = command.type === "assign" ? { type: "handover" as const, assetId: command.assetId, kind: "issue" as const, workerKey: command.workerKey, siteKey: command.siteKey, method: "selection" as const } : command.type === "return" ? { type: "handover" as const, assetId: command.assetId, kind: "return" as const, method: "selection" as const } : command;
  switch (c.type) {
    case "register": {
      assert(actor.role === "admin", "permission");
      const vehicle = c.details.category === "vehicle";
      const plate = vehicle ? normalizeIdentity(c.plate || c.code || "") : undefined;
      const code = vehicle ? plate! : normalizeIdentity(c.code || `BF-${c.assetId.slice(0, 8)}`);
      const barcode = vehicle && c.barcode?.trim() ? normalizeIdentity(c.barcode) : undefined;
      assert(vehicle ? /^[A-ZÄÖÜ0-9 -]{1,24}$/.test(code) : /^[A-Z0-9 .$/+%\-]{1,80}$/.test(code), "required");
      assert(!barcode || /^[A-Z0-9 .$/+%\-]{1,80}$/.test(barcode), "required");
      assert(!barcode || barcode !== plate, "required");
      const asset: WorkshopAsset = { id: c.assetId, name: c.name, code, kind: vehicle ? "fleet" : "tool", ...(plate ? { plate } : {}), ...(barcode ? { barcode } : {}), location: "Lager", holder: "", inspection: c.inspection, details: c.details, events: [] };
      assert(!state.assets.some(a => a.id === c.assetId) && !identityCollision(asset, state.assets), "duplicate");
      state.assets.unshift(asset); event(asset, "registered", code); break;
    }
    case "edit-asset": {
      assert(actor.role === "admin", "permission"); const a = assetFor(c.assetId);
      const before = { name: a.name, plate: assetPlate(a), barcode: a.barcode };
      const vehicle = c.details.category === "vehicle";
      const plate = vehicle ? normalizeIdentity(c.plate ?? assetPlate(a) ?? "") : undefined;
      const barcode = vehicle ? (c.barcode === undefined ? a.barcode : normalizeIdentity(c.barcode) || undefined) : undefined;
      assert(!vehicle || Boolean(plate && /^[A-ZÄÖÜ0-9 -]{1,24}$/.test(plate)), "required");
      assert(!barcode || /^[A-Z0-9 .$/+%\-]{1,80}$/.test(barcode), "required");
      assert(!barcode || barcode !== plate, "required");
      a.name = c.name; a.details = c.details; a.kind = vehicle ? "fleet" : "tool";
      if (plate) a.plate = plate; else delete a.plate;
      if (barcode) a.barcode = barcode; else delete a.barcode;
      assert(!identityCollision(a, state.assets), "duplicate");
      // Preserve immutable record/code, custody, repairs and photographs on a plate change.
      event(a, "updated", JSON.stringify({ before, after: { name: a.name, plate: assetPlate(a), barcode: a.barcode } })); break;
    }
    case "policy": assert(actor.role === "admin", "permission"); state.custody.autoConfirm = c.autoConfirm; state.custody.policyEvents.unshift({ id, autoConfirm: c.autoConfirm, at: now, actor }); break;
    case "read-notifications": state.custody.notifications.forEach(n => { if (n.recipient === actor.key && c.ids.includes(n.id)) n.readAt = now; }); break;
    case "handover": {
      const asset = assetFor(c.assetId); assert(!pendingFor(asset.id), "pending");
      const current = asset.placement;
      assert(current || !asset.holder || c.kind === "return", "transition");
      assert(!["workshop", "inspection"].includes(availability(state, asset, now)) || (c.kind === "return" && !activeJob(state, asset.id)));
      let to: InventoryPlacement | undefined;
      if (c.kind !== "return") to = placement(c.kind === "take" ? actor.key : "workerKey" in c ? c.workerKey : undefined, "siteKey" in c ? c.siteKey : undefined);
      if (c.kind === "take") assert(actor.role === "worker" && !current && !asset.holder);
      else if (c.kind === "return") assert(current || asset.holder, "transition");
      else assert(actor.role === "admin" || (actor.key === current?.workerKey && c.kind === "transfer"), "permission");
      if (c.kind === "return") assert(actor.role === "admin" || current?.workerKey === actor.key, "permission");
      const kind = c.kind === "return" ? "return" : current?.workerKey && current.workerKey !== to?.workerKey ? "transfer" : "issue";
      assert(kind === "return" || JSON.stringify(to) !== JSON.stringify(current), "transition");
      if (c.kind === "transfer") assert(kind === "transfer", "transition");
      const required = kind === "transfer" ? [current!.workerKey!, to!.workerKey!] : [...new Set(["admin", kind === "return" ? current?.workerKey || "admin" : to!.workerKey!])];
      const automatic = kind !== "transfer" && state.custody.autoConfirm;
      const h: Handover = { id, fromHolder: asset.holder, assetId: asset.id, kind, status: "pending", ...(current ? { from: structuredClone(current) } : {}), ...(to ? { to } : {}), createdBy: actor, at: now, updatedAt: now, method: c.method, automatic, required, confirmations: required.includes(actor.key) ? [{ actorKey: actor.key, by: actor.key, at: now, mode: "explicit" }] : [], reason: "" };
      if (automatic) h.confirmations = required.map(key => ({ actorKey: key, by: actor.key, at: now, mode: key === actor.key ? "explicit" : "policy" }));
      state.custody.handovers.unshift(h); event(asset, "handover_requested", h.kind, h.id, h.method);
      notify(h, "requested", required.filter(k => !h.confirmations.some(c => c.actorKey === k))); complete(h); break;
    }
    case "confirm-handover": case "decline-handover": case "cancel-handover": {
      const h = state.custody.handovers.find(h => h.id === c.handoverId); assert(h?.status === "pending", "transition");
      if (c.type === "cancel-handover") { assert(actor.role === "admin" || h.createdBy.key === actor.key, "permission"); h.status = "cancelled"; event(assetFor(h.assetId), "handover_cancelled", "", h.id); notify(h, "cancelled"); }
      else {
        assert(h.required.includes(actor.key), "permission");
        if (c.type === "decline-handover") { h.status = "declined"; h.reason = c.reason; event(assetFor(h.assetId), "handover_declined", c.reason, h.id); notify(h, "declined"); }
        else { assert(!h.confirmations.some(c => c.actorKey === actor.key), "transition"); h.confirmations.push({ actorKey: actor.key, by: actor.key, at: now, mode: "explicit" }); event(assetFor(h.assetId), "handover_confirmed", actor.name, h.id); notify(h, "confirmed", [h.createdBy.key]); complete(h); }
      }
      h.updatedAt = now; break;
    }
    case "tree": {
      assert(baseTree, "missing"); const key = treeIdentity(c.siteKey, c.treeCode), previous = state.custody.trees[key];
      const value: z.infer<typeof treeUpdateSchema> = previous || { status: ["done", "blocked"].includes(baseTree.status) ? baseTree.status as "done" | "blocked" : "todo", note: baseTree.note, at: now, actor };
      if (c.action === "done") { assert(value.status !== "blocked", "blocked"); value.status = "done"; }
      if (c.action === "reopen") { assert(actor.role === "admin" || value.status !== "blocked", "permission"); value.status = "todo"; }
      if (c.action === "report") { assert(c.note, "required"); value.status = "blocked"; value.note = c.note; }
      if (c.action === "edit") { assert(actor.role === "admin", "permission"); if (c.species !== undefined) value.species = c.species; if (c.diameter !== undefined) value.diameter = c.diameter; value.note = c.note; }
      if (c.action === "equipment") { assert(c.equipment, "required"); value.equipment = c.equipment; }
      value.at = now; value.actor = actor; state.custody.trees[key] = value;
      state.custody.treeEvents.unshift({ id, siteKey: c.siteKey, treeCode: c.treeCode, kind: c.action === "done" ? "done" : c.action === "reopen" ? "reopened" : c.action === "report" ? "reported" : c.action === "edit" ? "updated" : "equipment", note: c.note, at: now, actor }); break;
    }
    default: {
      if (c.type === "receive") {
        const a = assetFor(c.assetId); assert(actor.role === "admin" || a.placement?.workerKey === actor.key, "permission");
        const pending = pendingFor(a.id); if (pending) { pending.status = "cancelled"; pending.updatedAt = now; pending.reason = "Werkstatt"; event(a, "handover_cancelled", "Werkstatt", pending.id); notify(pending, "cancelled"); }
      } else assert(actor.role === "admin", "permission");
      state = applyWorkshopCommand(state, c, now, id);
      state.movements.filter(m => m.id === id).forEach(m => { m.actor = actor.name; });
      state.assets.forEach(a => a.events.filter(e => e.id === id).forEach(e => { e.actor = actor.name; e.actorKey = actor.key; }));
    }
  }
  return workshopSchema.parse(state);
}

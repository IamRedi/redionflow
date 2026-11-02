/**
 * Work phases for metal construction sites. A steel site does not track
 * trees or cones: it moves through a few clear phases that a worker can
 * tick off on a touch screen. Each phase is stored as one TreeItem row of
 * the site (treeId = phase key, status = todo / done / blocked), so the
 * existing progress counters, realtime updates and reports keep working.
 */

export const STEEL_SITE_TYPES = ["STEEL_WORKSHOP", "STEEL_ASSEMBLY"] as const;
export type SteelSiteType = (typeof STEEL_SITE_TYPES)[number];

export type SteelPhaseKey =
  | "foundation"
  | "columns"
  | "trusses"
  | "painting"
  | "cutting"
  | "drilling"
  | "welding"
  | "coating"
  /** A task the office added to one site (its own name, no fixed scene). */
  | "task";

export type SteelPhaseDef = { key: SteelPhaseKey; treeId: string };

const PREFIX = "steel-";

const PHASES: Record<SteelSiteType, SteelPhaseKey[]> = {
  // On site: concrete base with anchor bolts, columns, roof trusses, paint touch-up.
  STEEL_ASSEMBLY: ["foundation", "columns", "trusses", "painting"],
  // Workshop: cut, drill, weld, then paint or galvanise before delivery.
  STEEL_WORKSHOP: ["cutting", "drilling", "welding", "coating"],
};

export function isSteelSiteType(type: string | null | undefined): type is SteelSiteType {
  return (STEEL_SITE_TYPES as readonly string[]).includes(String(type ?? ""));
}

export function steelPhasesFor(type: string | null | undefined): SteelPhaseDef[] {
  if (!isSteelSiteType(type)) return [];
  return PHASES[type].map((key) => ({ key, treeId: `${PREFIX}${key}` }));
}

export const STEEL_TASK_PREFIX = `${PREFIX}task-`;

export function steelPhaseKeyFromTreeId(treeId: string): SteelPhaseKey | null {
  if (!treeId.startsWith(PREFIX)) return null;
  if (treeId.startsWith(STEEL_TASK_PREFIX)) return "task";
  const key = treeId.slice(PREFIX.length);
  const all = [...PHASES.STEEL_ASSEMBLY, ...PHASES.STEEL_WORKSHOP] as string[];
  return all.includes(key) ? (key as SteelPhaseKey) : null;
}

export type SteelPhaseMeta = {
  note: string;
  noteBy: string;
  noteAt: string;
  material: string;
  materialBy: string;
  materialAt: string;
  doneBy: string;
  /** Name of an office-added task; empty for the fixed phases. */
  label: string;
};

const EMPTY_META: SteelPhaseMeta = { note: "", noteBy: "", noteAt: "", material: "", materialBy: "", materialAt: "", doneBy: "", label: "" };

export function readSteelPhaseMeta(notes: string | null | undefined): SteelPhaseMeta {
  if (!notes) return { ...EMPTY_META };
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...EMPTY_META };
    const text = (key: keyof SteelPhaseMeta) => (typeof parsed[key] === "string" ? (parsed[key] as string) : "");
    return {
      note: text("note"),
      noteBy: text("noteBy"),
      noteAt: text("noteAt"),
      material: text("material"),
      materialBy: text("materialBy"),
      materialAt: text("materialAt"),
      doneBy: text("doneBy"),
      label: text("label"),
    };
  } catch {
    return { ...EMPTY_META };
  }
}

export type SteelPhaseStatus = "todo" | "done" | "blocked";

export type SteelPhaseCommand =
  | { kind: "done"; actor: string }
  | { kind: "reopen" }
  | { kind: "note"; actor: string; text: string }
  | { kind: "missing"; actor: string; text: string }
  | { kind: "materialArrived" };

/**
 * Applies one touch action to a phase. Missing material blocks the phase
 * until it arrives; finishing a phase clears an open material request.
 */
export function applySteelPhaseCommand(
  current: { status: SteelPhaseStatus; meta: SteelPhaseMeta },
  command: SteelPhaseCommand,
  now: Date,
): { status: SteelPhaseStatus; meta: SteelPhaseMeta } {
  const at = now.toISOString();
  const meta = { ...current.meta };
  switch (command.kind) {
    case "done":
      return { status: "done", meta: { ...meta, doneBy: command.actor, material: "", materialBy: "", materialAt: "" } };
    case "reopen":
      return { status: meta.material ? "blocked" : "todo", meta: { ...meta, doneBy: "" } };
    case "note":
      return { status: current.status, meta: { ...meta, note: command.text, noteBy: command.text ? command.actor : "", noteAt: command.text ? at : "" } };
    case "missing":
      return { status: "blocked", meta: { ...meta, material: command.text, materialBy: command.actor, materialAt: at } };
    case "materialArrived":
      return { status: current.status === "blocked" ? "todo" : current.status, meta: { ...meta, material: "", materialBy: "", materialAt: "" } };
  }
}

export type SteelSiteShape = "hall" | "bridge" | "building";

/**
 * Picks the drawing for a site card from its name and description: a bridge,
 * a multi-storey steel frame (hotel, theatre, tower ...) or an industrial hall.
 */
export function steelSiteShape(name: string, description?: string | null): SteelSiteShape {
  const words = `${name} ${description ?? ""}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const has = (pattern: RegExp) => words.some((word) => pattern.test(word));
  if (has(/^(ur[aëe]|urës|bridge|brücke|viadukt|viaduct|pasarel|mbikalim)/)) return "bridge";
  if (has(/^(hotel|teat|kull|pallat|ndërtes|ndertes|godin|resort|building|tower|shkoll|spital|qendr|mall$|rezidenc|apartament|stadium)/)) return "building";
  return "hall";
}

/**
 * Factory production line for metal construction (BauFlow template
 * "Stahlbau mit Produktion"). The factory is not a construction site: it
 * processes material groups that are allocated to a construction site and
 * signals "ready for site" once every step of a group is done.
 *
 * The steps are an example line until the firm confirms its real process;
 * they are stored on each group, so a later per-company configuration does
 * not rewrite groups that are already on the line.
 */

export const FACTORY_STEP_KEYS = ["cutting", "laser", "assembly", "final"] as const;
export type FactoryStepKey = (typeof FACTORY_STEP_KEYS)[number];

export type FactoryStepStatus = "todo" | "active" | "done" | "blocked";

export type FactoryStep = {
  key: string;
  status: FactoryStepStatus;
  note: string;
  by: string;
  at: string;
};

export const PRODUCTION_UNITS = ["t", "kg", "pcs", "m", "m2"] as const;
export type ProductionUnit = (typeof PRODUCTION_UNITS)[number];

export function initialFactorySteps(keys: readonly string[] = FACTORY_STEP_KEYS): FactoryStep[] {
  return keys.map((key) => ({ key, status: "todo", note: "", by: "", at: "" }));
}

const STATUSES: FactoryStepStatus[] = ["todo", "active", "done", "blocked"];

/** Reads the JSON column defensively; unknown shapes become an empty line. */
export function readFactorySteps(value: unknown): FactoryStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.key !== "string" || !row.key) return [];
    const status = STATUSES.includes(row.status as FactoryStepStatus) ? (row.status as FactoryStepStatus) : "todo";
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
    return [{ key: row.key, status, note: text("note"), by: text("by"), at: text("at") }];
  });
}

/** Index of the first step that is not done, or -1 when the whole line is done. */
export function currentStepIndex(steps: FactoryStep[]) {
  return steps.findIndex((step) => step.status !== "done");
}

export type BatchState = "waiting" | "inProgress" | "blocked" | "ready";

export function batchState(steps: FactoryStep[]): BatchState {
  if (steps.length > 0 && steps.every((step) => step.status === "done")) return "ready";
  if (steps.some((step) => step.status === "blocked")) return "blocked";
  if (steps.some((step) => step.status === "active" || step.status === "done")) return "inProgress";
  return "waiting";
}

export type StepCommand =
  | { kind: "start" }
  | { kind: "done" }
  | { kind: "reopen" }
  | { kind: "block"; text: string }
  | { kind: "unblock" }
  | { kind: "note"; text: string };

export type StepChange = {
  steps: FactoryStep[];
  event: { stepKey: string; action: StepCommand["kind"]; fromStatus: FactoryStepStatus; toStatus: FactoryStepStatus; note: string };
};

export class StepCommandError extends Error {}

/**
 * Applies one touch on one step. The line runs in order: a step can only
 * start or finish once every earlier step is done, and only the last done
 * step can be reopened (so later work is never silently undone).
 */
export function applyStepCommand(steps: FactoryStep[], index: number, command: StepCommand, actor: string, now: Date): StepChange {
  const step = steps[index];
  if (!step) throw new StepCommandError("Unknown step.");
  const earlierDone = steps.slice(0, index).every((item) => item.status === "done");
  const laterTouched = steps.slice(index + 1).some((item) => item.status !== "todo");
  const at = now.toISOString();
  let next: FactoryStep = step;

  switch (command.kind) {
    case "start":
      if (!earlierDone || step.status === "done") throw new StepCommandError("Step cannot start now.");
      next = { ...step, status: "active", by: actor, at };
      break;
    case "done":
      if (!earlierDone || step.status === "done") throw new StepCommandError("Step cannot be finished now.");
      next = { ...step, status: "done", by: actor, at };
      break;
    case "reopen":
      if (step.status !== "done" || laterTouched) throw new StepCommandError("Only the last finished step can be reopened.");
      next = { ...step, status: "active", by: actor, at };
      break;
    case "block": {
      const text = command.text.trim();
      if (!text) throw new StepCommandError("A reason is required.");
      if (step.status === "done") throw new StepCommandError("A finished step cannot be blocked.");
      next = { ...step, status: "blocked", note: text, by: actor, at };
      break;
    }
    case "unblock":
      if (step.status !== "blocked") throw new StepCommandError("Step is not blocked.");
      // The reason stays in the history; the open note is cleared.
      next = { ...step, status: "active", note: "", by: actor, at };
      break;
    case "note":
      next = { ...step, note: command.text.trim(), by: command.text.trim() ? actor : step.by, at: command.text.trim() ? at : step.at };
      break;
  }

  const updated = steps.map((item, i) => (i === index ? next : item));
  return {
    steps: updated,
    event: {
      stepKey: step.key,
      action: command.kind,
      fromStatus: step.status,
      toStatus: next.status,
      note: command.kind === "block" || command.kind === "note" ? command.text.trim() : "",
    },
  };
}

/** "X of Y groups ready" for a construction site. */
export function readySummary(batches: Array<{ steps: FactoryStep[] }>) {
  const total = batches.length;
  const ready = batches.filter((batch) => batchState(batch.steps) === "ready").length;
  return { ready, total };
}

/** Same output on server and client (no ICU differences): "12,5" or "12.5" in English. */
export function formatQuantity(value: number, lang: string) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return lang === "en" ? text : text.replace(".", ",");
}

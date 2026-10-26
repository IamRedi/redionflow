export type MachineDefect = {
  id: string;
  text: string;
  reportedBy: string;
  reportedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
};

export type MachineNotesState = {
  defects: MachineDefect[];
  body: string;
};

const LEGACY_CAUTION_PREFIX = "[[KUJDES]]";
const MACHINE_NOTES_PREFIX = "[[MACHINE_NOTES]]";
const MAX_DEFECT_HISTORY = 5;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDefect(value: unknown): MachineDefect | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = cleanText(row.id);
  const text = cleanText(row.text);
  const reportedBy = cleanText(row.reportedBy);
  const reportedAt = cleanText(row.reportedAt);
  if (!id || !text || !reportedAt) return null;

  const resolvedBy = cleanText(row.resolvedBy);
  const resolvedAt = cleanText(row.resolvedAt);
  return {
    id,
    text,
    reportedBy: reportedBy || "System",
    reportedAt,
    ...(resolvedBy ? { resolvedBy } : {}),
    ...(resolvedAt ? { resolvedAt } : {}),
  };
}

export function parseMachineNotes(value: string | null): MachineNotesState {
  const raw = (value ?? "").trim();
  if (!raw) return { defects: [], body: "" };

  const [firstLine = "", ...restLines] = raw.split("\n");
  if (firstLine.startsWith(MACHINE_NOTES_PREFIX)) {
    try {
      const parsed = JSON.parse(firstLine.slice(MACHINE_NOTES_PREFIX.length).trim()) as { defects?: unknown };
      const defects = Array.isArray(parsed.defects) ? parsed.defects.map(cleanDefect).filter((item): item is MachineDefect => Boolean(item)) : [];
      return { defects: defects.slice(0, MAX_DEFECT_HISTORY), body: restLines.join("\n").trim() };
    } catch {
      return { defects: [], body: raw };
    }
  }

  if (firstLine.startsWith(LEGACY_CAUTION_PREFIX)) {
    const text = firstLine.slice(LEGACY_CAUTION_PREFIX.length).trim();
    const defects = text
      ? [
          {
            id: "legacy-caution",
            text,
            reportedBy: "System",
            reportedAt: new Date(0).toISOString(),
          },
        ]
      : [];
    return { defects, body: restLines.join("\n").trim() };
  }

  return { defects: [], body: raw };
}

export function serializeMachineNotes(state: MachineNotesState) {
  const defects = state.defects.slice(0, MAX_DEFECT_HISTORY);
  const body = state.body.trim();
  const parts: string[] = [];
  if (defects.length > 0) parts.push(`${MACHINE_NOTES_PREFIX} ${JSON.stringify({ defects })}`);
  if (body) parts.push(body);
  return parts.length ? parts.join("\n") : null;
}

export function getActiveMachineDefect(notes: string | null) {
  return parseMachineNotes(notes).defects.find((defect) => !defect.resolvedAt) ?? null;
}

export function getVisibleMachineNotes(notes: string | null) {
  return parseMachineNotes(notes).body;
}

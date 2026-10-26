import { isRecord, readLatLng } from "@/lib/workzone/site-json";
import { localeForExport, type ExportLang, type ExportText } from "./text";

export function sanitizeSegment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "baustelle"
  );
}

export function asText(data: string) {
  return Buffer.from(data, "utf8");
}

export function formatDateTime(value: Date | null | undefined, lang: ExportLang) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeForExport(lang), {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatDate(value: Date | null | undefined, lang: ExportLang) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeForExport(lang), {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function coordsFromJson(value: unknown): { lat: number | null; lng: number | null } {
  return readLatLng(value) ?? { lat: null, lng: null };
}

export function displayWorkerName(worker: { firstName: string; lastName: string } | null | undefined) {
  if (!worker) return "-";
  return `${worker.firstName} ${worker.lastName}`.trim();
}

export function displayAdminName(admin: { name: string | null; email: string } | null | undefined) {
  if (!admin) return "-";
  return admin.name?.trim() || admin.email;
}

export function actorLabel(
  actorRole: string | null | undefined,
  actorName: string | null | undefined,
  worker: { firstName: string; lastName: string } | null | undefined,
  admin: { name: string | null; email: string } | null | undefined,
) {
  if (actorName?.trim()) return actorName.trim();
  if (actorRole === "ADMIN") return displayAdminName(admin);
  if (worker) return displayWorkerName(worker);
  return actorRole ?? "-";
}

export function treeStatusLabel(status: string, text: ExportText) {
  if (status === "done") return text.done;
  if (status === "blocked") return text.blocked;
  return text.open;
}

export function parseTreeMeta(notes: string | null) {
  if (!notes) {
    return {
      note: "",
      haltverbot: false,
      action: "",
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
    };
  }

  try {
    const json: unknown = JSON.parse(notes);
    const parsed = isRecord(json) ? json : {};
    return {
      note: typeof parsed.note === "string" ? parsed.note : "",
      haltverbot: Boolean(parsed.haltverbot),
      action:
        typeof parsed.action === "string"
          ? parsed.action
          : typeof parsed.massnahme === "string"
            ? parsed.massnahme
          : typeof parsed.task === "string"
              ? parsed.task
              : "",
      branchCutsOver10:
        typeof parsed.branchCutsOver10 === "number" || typeof parsed.branchCutsOver10 === "string"
          ? String(parsed.branchCutsOver10)
          : typeof parsed.asteOver10 === "number" || typeof parsed.asteOver10 === "string"
            ? String(parsed.asteOver10)
            : "",
      branchCutsOver20:
        typeof parsed.branchCutsOver20 === "number" || typeof parsed.branchCutsOver20 === "string"
          ? String(parsed.branchCutsOver20)
          : typeof parsed.asteOver20 === "number" || typeof parsed.asteOver20 === "string"
            ? String(parsed.asteOver20)
            : "",
      branchCutsOver30:
        typeof parsed.branchCutsOver30 === "number" || typeof parsed.branchCutsOver30 === "string"
          ? String(parsed.branchCutsOver30)
          : typeof parsed.asteOver30 === "number" || typeof parsed.asteOver30 === "string"
            ? String(parsed.asteOver30)
            : "",
      extraWork:
        parsed.extraWork === "25% +" ||
        parsed.extraWork === "50% +" ||
        parsed.extraWork === "75% +" ||
        parsed.extraWork === "100% +"
          ? parsed.extraWork
          : parsed.extraWork === "25%" ||
              parsed.extraWork === "50%" ||
              parsed.extraWork === "75%" ||
              parsed.extraWork === "100%"
            ? `${parsed.extraWork} +`
            : "",
    };
  } catch {
    return {
      note: notes,
      haltverbot: false,
      action: "",
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
    };
  }
}

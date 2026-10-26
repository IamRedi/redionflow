export type StorageScope = "worker-assets" | "baustelle-documents";
export type ManagedReference = { scope: StorageScope; entityId: string; fileName: string };
export function safeObjectSegment(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/.test(value) && !value.includes("..");
}
export function managedFileReference(ref: ManagedReference) {
  if (!safeObjectSegment(ref.entityId) || !safeObjectSegment(ref.fileName)) throw new Error("Invalid managed object path.");
  return `/api/private-files?${new URLSearchParams(ref)}`;
}
export function parseManagedReference(value: string): ManagedReference | null {
  if (!value.startsWith("/api/private-files?")) return null;
  const url = new URL(value, "http://managed.invalid");
  const scope = url.searchParams.get("scope");
  const entityId = url.searchParams.get("entityId") ?? "";
  const fileName = url.searchParams.get("fileName") ?? "";
  if ((scope !== "worker-assets" && scope !== "baustelle-documents") || !safeObjectSegment(entityId) || !safeObjectSegment(fileName)) return null;
  if (["scope", "entityId", "fileName"].some(key => url.searchParams.getAll(key).length !== 1) || [...url.searchParams.keys()].some(key => !["scope", "entityId", "fileName"].includes(key))) return null;
  return { scope, entityId, fileName };
}

/**
 * BDF-P4-004: snapshots are business-data artifacts, never credential
 * backups. Keep this dependency-free so scripts and application exports use
 * precisely the same policy.
 */

const CREDENTIAL_FIELD = /(?:password|credential|login[_-]?code|^(?:pin|token|secret)$|(?:access|refresh|fcm|fleetIngest)Token$|api[_-]?key|reset[_-]?code|session(?:Token|Key)$)/i;

export type SnapshotRecord = Record<string, unknown>;

export function isCredentialSnapshotField(field: string): boolean {
  return CREDENTIAL_FIELD.test(field);
}

function shouldRemoveSnapshotField(field: string, value: unknown): boolean {
  // Model/table containers can themselves be named "token" or "session".
  // Preserve their shape and remove the scalar credential values within.
  return isCredentialSnapshotField(field) && (value === null || typeof value !== "object");
}

export function sanitizeSnapshotValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSnapshotValue(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as SnapshotRecord)
        .filter(([field, entry]) => !shouldRemoveSnapshotField(field, entry))
        .map(([field, entry]) => [field, sanitizeSnapshotValue(entry)]),
    ) as T;
  }

  return value;
}

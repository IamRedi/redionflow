/**
 * Narrows untrusted form input to one of a Prisma enum's values. Unknown or
 * missing input falls back instead of reaching the database as an invalid
 * enum literal.
 */
export function parseEnumInput<T extends string>(
  value: FormDataEntryValue | null | undefined,
  allowed: Record<string, T>,
  fallback: T,
): T {
  const raw = typeof value === "string" ? value.trim() : "";
  return (Object.values(allowed) as string[]).includes(raw) ? (raw as T) : fallback;
}

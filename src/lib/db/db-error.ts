/**
 * Collects this error and nested causes (and AggregateError.errors) without infinite loops.
 */
function collectErrorNodes(err: unknown): unknown[] {
  const out: unknown[] = [];
  const stack: unknown[] = [err];
  const seenObjects = new Set<object>();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === undefined || cur === null) continue;
    out.push(cur);
    if (typeof cur !== "object") continue;
    if (seenObjects.has(cur)) continue;
    seenObjects.add(cur);
    const o = cur as Record<string, unknown>;
    if (o.cause !== undefined) stack.push(o.cause);
    if (Array.isArray(o.errors)) for (const e of o.errors) stack.push(e);
  }
  return out;
}

function nodeIndicatesDbUnavailable(node: unknown): boolean {
  if (node === null || node === undefined) return false;
  if (typeof node === "string") {
    return /ECONNREFUSED|Can't reach database|connection refused/i.test(node);
  }
  if (typeof node !== "object") return false;
  const o = node as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "";
  const name = typeof o.name === "string" ? o.name : "";
  if (code === "P1001" || code === "P1000" || code === "ECONNREFUSED") return true;
  if (name === "PrismaClientInitializationError") return true;
  const syscall = typeof o.syscall === "string" ? o.syscall : "";
  if (syscall === "connect" && code === "ECONNREFUSED") return true;
  const msg = String(o.message ?? "");
  if (/ECONNREFUSED|Can't reach database server|P1001|connection refused|connect ECONNREFUSED/i.test(msg)) return true;
  const meta = o.meta;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    if (typeof m.code === "string" && m.code === "ECONNREFUSED") return true;
  }
  return false;
}

/**
 * True when Prisma failed because the DB server is unreachable (typical local dev: Docker not running).
 * Prisma often wraps the driver error: the top message is "Invalid `prisma…` invocation" while ECONNREFUSED sits in `cause`.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  for (const node of collectErrorNodes(error)) {
    if (nodeIndicatesDbUnavailable(node)) return true;
  }
  return false;
}

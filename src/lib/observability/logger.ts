/**
 * BDF-P8-007 structured logger.
 *
 * Every server-side log line goes through this module. Its job is to
 * emit a single JSON object per event so an aggregator (Loki, Datadog,
 * CloudWatch, whatever the deployment chooses) can index by level,
 * event, tenantId, userId, and requestId without regex parsing.
 *
 * Deliberately zero runtime dependencies. Node's `console.*` already
 * writes to stdout / stderr; we only shape the payload.
 *
 * Callers replace ad-hoc `console.warn(...)` calls with:
 *
 *     logger.warn({ event: "auth.login_invalid", email }, "login rejected");
 *
 * The first argument (context) is required and MUST include an `event`
 * key so filters can group. Free-form message is optional.
 *
 * In tests, set `BDF_LOGGER_SILENT=1` to suppress output; in
 * development, set `BDF_LOGGER_PRETTY=1` to switch to a human-readable
 * one-liner instead of JSON.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LEVELS)[number];

type LogContext = {
  /** Namespaced event key (e.g. "auth.login_invalid"). Required. */
  event: string;
  /** Any additional structured fields — kept flat so the aggregator can index them. */
  [key: string]: unknown;
};

type LoggerRecord = {
  level: LogLevel;
  time: string;
  event: string;
  message?: string;
  [key: string]: unknown;
};

const SILENT = process.env.BDF_LOGGER_SILENT === "1" || process.env.BDF_LOGGER_SILENT === "true";
const PRETTY =
  process.env.BDF_LOGGER_PRETTY === "1" ||
  process.env.BDF_LOGGER_PRETTY === "true" ||
  (process.env.NODE_ENV === "development" && process.env.BDF_LOGGER_PRETTY !== "0");

const MIN_LEVEL_INDEX = (() => {
  const configured = String(process.env.BDF_LOG_LEVEL ?? "").toLowerCase();
  const idx = LEVELS.indexOf(configured as LogLevel);
  if (idx >= 0) return idx;
  return process.env.NODE_ENV === "production" ? LEVELS.indexOf("info") : LEVELS.indexOf("debug");
})();

/**
 * Redact anything that looks like a secret before it lands in a log.
 * Never remove the key — replacing the *value* preserves debuggability
 * (you can still see the field existed) while blocking the credential
 * itself from being scraped out of the log store.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "logincode",
  "logincodehash",
  "token",
  "accesstoken",
  "refreshtoken",
  "fcmtoken",
  "apikey",
  "secret",
  "authorization",
  "cookie",
  "sessiontoken",
]);

function redact(input: unknown, seen = new WeakSet<object>()): unknown {
  if (input === null || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  if (seen.has(obj)) return "[circular]";
  seen.add(obj);
  if (Array.isArray(obj)) return obj.map((entry) => redact(entry, seen));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = value === null || value === undefined || value === "" ? value : "[redacted]";
    } else {
      out[key] = redact(value, seen);
    }
  }
  return out;
}

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err as unknown as Record<string, unknown>),
    };
  }
  if (typeof err === "object") return err as Record<string, unknown>;
  return { message: String(err) };
}

/**
 * Node writes straight to stdout/stderr. The Edge runtime (instrumentation
 * runs there too) has no process streams, so it falls back to console. The
 * stream is looked up by name so the Edge bundle carries no static
 * `process.stdout` reference.
 */
function lineWriter(name: "stdout" | "stderr"): (line: string) => void {
  const stream = (globalThis as { process?: Partial<Record<"stdout" | "stderr", { write(chunk: string): unknown }>> })
    .process?.[name];
  if (stream) return (line) => void stream.write(`${line}\n`);
  return name === "stderr" ? (line) => console.error(line) : (line) => console.log(line);
}

function emit(level: LogLevel, context: LogContext, message?: string, err?: unknown): void {
  if (SILENT) return;
  const configuredIndex = LEVELS.indexOf(level);
  if (configuredIndex < MIN_LEVEL_INDEX) return;

  const record: LoggerRecord = {
    level,
    time: new Date().toISOString(),
    event: context.event,
    ...(redact(context) as Record<string, unknown>),
  };
  if (message) record.message = message;
  if (err !== undefined) record.error = redact(serializeError(err));

  const write = lineWriter(level === "error" ? "stderr" : "stdout");

  if (PRETTY) {
    const kv = Object.entries(record)
      .filter(([k]) => k !== "level" && k !== "time" && k !== "event" && k !== "message")
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    write(`[${record.time}] ${level.toUpperCase()} ${record.event}${message ? ` — ${message}` : ""}${kv ? ` ${kv}` : ""}`);
    return;
  }

  write(JSON.stringify(record));
}

export const logger = {
  debug: (context: LogContext, message?: string) => emit("debug", context, message),
  info: (context: LogContext, message?: string) => emit("info", context, message),
  warn: (context: LogContext, message?: string, err?: unknown) => emit("warn", context, message, err),
  error: (context: LogContext, message?: string, err?: unknown) => emit("error", context, message, err),
};

export type Logger = typeof logger;

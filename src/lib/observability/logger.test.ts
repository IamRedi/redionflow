import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The logger reads env at import time, so it needs to be re-imported inside
// each test scope after setting the vars we care about.

async function loadLogger(env: Record<string, string>) {
  vi.resetModules();
  const original = { ...process.env };
  // Clear any repo-wide env from vitest.config so tests start from a clean slate.
  delete process.env.BDF_LOGGER_SILENT;
  delete process.env.BDF_LOGGER_PRETTY;
  delete process.env.BDF_LOG_LEVEL;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const mod = await import("./logger");
  return {
    logger: mod.logger,
    restore: () => {
      for (const k of Object.keys(env)) delete process.env[k];
      Object.assign(process.env, original);
    },
  };
}

describe("logger", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  const captured: { stream: "stdout" | "stderr"; line: string }[] = [];

  beforeEach(() => {
    captured.length = 0;
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      captured.push({ stream: "stdout", line: typeof chunk === "string" ? chunk : chunk.toString("utf8") });
      return true;
    });
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
      captured.push({ stream: "stderr", line: typeof chunk === "string" ? chunk : chunk.toString("utf8") });
      return true;
    });
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it("emits JSON with level, time, and event by default", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_PRETTY: "0", BDF_LOG_LEVEL: "debug" });
    logger.info({ event: "auth.login" }, "signed in");
    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0].line);
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("auth.login");
    expect(parsed.message).toBe("signed in");
    expect(typeof parsed.time).toBe("string");
    expect(new Date(parsed.time).toString()).not.toBe("Invalid Date");
    restore();
  });

  it("routes error level to stderr, others to stdout", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_PRETTY: "0", BDF_LOG_LEVEL: "debug" });
    logger.info({ event: "auth.login" });
    logger.error({ event: "auth.error" });
    const streams = captured.map((c) => c.stream);
    expect(streams).toEqual(["stdout", "stderr"]);
    restore();
  });

  it("redacts sensitive keys but keeps the field structure", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_PRETTY: "0", BDF_LOG_LEVEL: "debug" });
    logger.warn({
      event: "auth.attempt",
      email: "user@example.com",
      password: "hunter2",
      nested: { fcmToken: "abcd1234", ok: true },
    });
    const parsed = JSON.parse(captured[0].line);
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.nested.fcmToken).toBe("[redacted]");
    expect(parsed.nested.ok).toBe(true);
    restore();
  });

  it("respects BDF_LOG_LEVEL to drop lower-severity events", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_PRETTY: "0", BDF_LOG_LEVEL: "warn" });
    logger.debug({ event: "noop" });
    logger.info({ event: "noop" });
    logger.warn({ event: "kept" });
    expect(captured).toHaveLength(1);
    expect(JSON.parse(captured[0].line).event).toBe("kept");
    restore();
  });

  it("stays silent when BDF_LOGGER_SILENT is set", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_SILENT: "1", BDF_LOG_LEVEL: "debug" });
    logger.info({ event: "would.be.dropped" });
    logger.error({ event: "also.dropped" });
    expect(captured).toHaveLength(0);
    restore();
  });

  it("serializes an Error passed as the third argument", async () => {
    const { logger, restore } = await loadLogger({ BDF_LOGGER_PRETTY: "0", BDF_LOG_LEVEL: "debug" });
    const err = new Error("boom");
    err.name = "TestBoom";
    logger.error({ event: "unexpected" }, "wrap", err);
    const parsed = JSON.parse(captured[0].line);
    expect(parsed.error.name).toBe("TestBoom");
    expect(parsed.error.message).toBe("boom");
    expect(typeof parsed.error.stack).toBe("string");
    restore();
  });
});

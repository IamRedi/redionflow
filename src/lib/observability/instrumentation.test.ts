import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("instrumentation hooks", () => {
  const captured: string[] = [];
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    captured.length = 0;
    delete process.env.BDF_LOGGER_SILENT;
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      return true;
    });
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
      captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      return true;
    });
    vi.resetModules();
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    process.env.BDF_LOGGER_SILENT = "1";
  });

  it("register() emits a single server.startup event", async () => {
    const mod = await import("../../../instrumentation");
    await mod.register();
    const line = captured.find((entry) => entry.includes("server.startup"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line!);
    expect(parsed.event).toBe("server.startup");
    expect(parsed.level).toBe("info");
    expect(typeof parsed.nodeVersion).toBe("string");
  });

  it("onRequestError() logs the digest and route context but never the raw stack in user text", async () => {
    const mod = await import("../../../instrumentation");
    const err = new Error("boom");
    (err as { digest?: string }).digest = "abc123";
    await mod.onRequestError(
      err,
      {
        path: "/app/dashboard",
        method: "GET",
        headers: {},
      },
      {
        routerKind: "App Router",
        routePath: "/app/dashboard",
        routeType: "render",
      },
    );
    const line = captured.find((entry) => entry.includes("request.unhandled_error"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line!);
    expect(parsed.event).toBe("request.unhandled_error");
    expect(parsed.digest).toBe("abc123");
    expect(parsed.path).toBe("/app/dashboard");
    expect(parsed.method).toBe("GET");
    expect(parsed.routeType).toBe("render");
    // Structured error field should include the stack for engineers to
    // dig into.
    expect(parsed.error.message).toBe("boom");
    expect(typeof parsed.error.stack).toBe("string");
  });

  it("onRequestError() tolerates errors without a digest", async () => {
    const mod = await import("../../../instrumentation");
    await mod.onRequestError(
      new Error("no digest"),
      { path: "/api/x", method: "POST", headers: {} },
      { routerKind: "App Router", routePath: "/api/x", routeType: "route" },
    );
    const line = captured.find((entry) => entry.includes("request.unhandled_error"));
    const parsed = JSON.parse(line!);
    expect(parsed.digest).toBeNull();
  });
});

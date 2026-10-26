import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test the collector as a pure function of Request in / NextResponse out.
// The logger is muted by the vitest env; we spy on stderr to observe the
// emitted event.

describe("POST /api/csp-report", () => {
  const captured: string[] = [];
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let POST: typeof import("./route").POST;

  beforeEach(async () => {
    captured.length = 0;
    delete process.env.BDF_LOGGER_SILENT;
    vi.resetModules();
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    });
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    });
    POST = (await import("./route")).POST;
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    process.env.BDF_LOGGER_SILENT = "1";
  });

  async function post(body: unknown) {
    return POST(
      new Request("https://example.com/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("logs a legacy csp-report and returns 204", async () => {
    const res = await post({
      "csp-report": {
        "document-uri": "https://example.com/app/dashboard",
        "violated-directive": "img-src",
        "effective-directive": "img-src",
        "blocked-uri": "data:",
        disposition: "report",
      },
    });
    expect(res.status).toBe(204);
    const line = captured.find((c) => c.includes("csp.report_only.violation"));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line!);
    expect(parsed.variant).toBe("legacy");
    expect(parsed.violatedDirective).toBe("img-src");
    expect(parsed.blockedUri).toBe("data:");
  });

  it("logs a modern Reporting API payload and returns 204", async () => {
    const res = await post([
      {
        type: "csp-violation",
        url: "https://example.com/app/dashboard",
        user_agent: "Mozilla/5.0",
        body: {
          documentURL: "https://example.com/app/dashboard",
          violatedDirective: "script-src",
          effectiveDirective: "script-src",
          blockedURL: "inline",
          sourceFile: "https://example.com/_next/static/x.js",
          lineNumber: 42,
          disposition: "report",
        },
      },
    ]);
    expect(res.status).toBe(204);
    const line = captured.find((c) => c.includes("csp.report_only.violation"));
    const parsed = JSON.parse(line!);
    expect(parsed.variant).toBe("reports-api");
    expect(parsed.violatedDirective).toBe("script-src");
    expect(parsed.lineNumber).toBe(42);
    expect(parsed.userAgent).toBe("Mozilla/5.0");
  });

  it("returns 204 on malformed JSON without logging", async () => {
    const res = await POST(
      new Request("https://example.com/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(204);
    expect(captured.filter((c) => c.includes("csp.report_only.violation"))).toEqual([]);
  });

  it("returns 204 on empty payload without logging", async () => {
    const res = await post({});
    expect(res.status).toBe(204);
    expect(captured.filter((c) => c.includes("csp.report_only.violation"))).toEqual([]);
  });

  it("drops oversized reports without logging", async () => {
    const res = await post({ "csp-report": { "document-uri": "x".repeat(20_000) } });
    expect(res.status).toBe(204);
    expect(captured.filter((c) => c.includes("csp.report_only.violation"))).toEqual([]);
  });

  it("clips long fields in the log line", async () => {
    const res = await post({ "csp-report": { "document-uri": "https://example.com", "blocked-uri": "b".repeat(2_000) } });
    expect(res.status).toBe(204);
    const line = captured.find((c) => c.includes("csp.report_only.violation")) ?? "";
    expect(line).toContain("b".repeat(500));
    expect(line).not.toContain("b".repeat(501));
  });
});

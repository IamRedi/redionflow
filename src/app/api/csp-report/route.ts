import { NextResponse } from "next/server";

import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

/**
 * BDF-P8-007 Content-Security-Policy violation collector.
 *
 * The `Content-Security-Policy-Report-Only` header configured in
 * next.config.mjs points every browser here whenever the CSP would
 * have blocked a resource. We normalise both legacy (`report-uri` /
 * `application/csp-report`) and modern (`report-to` /
 * `application/reports+json`) payloads into a single structured log
 * event so an operator can widen the policy before we flip to
 * enforcement.
 *
 * We deliberately reply 204 unconditionally. A malformed report from
 * a broken browser extension is not our problem, and the browser
 * doesn't retry regardless.
 */

type LegacyCspReport = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "original-policy"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    disposition?: string;
    referrer?: string;
    "status-code"?: number;
  };
};

type ModernCspReport = {
  type?: string;
  age?: number;
  url?: string;
  user_agent?: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    violatedDirective?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    originalPolicy?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    disposition?: string;
    statusCode?: number;
    sample?: string;
  };
};

function normaliseReport(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;

  // Legacy (Content-Type: application/csp-report). Payload is a single
  // object with a `csp-report` key.
  const legacy = (payload as LegacyCspReport)["csp-report"];
  if (legacy) {
    return {
      variant: "legacy",
      documentUri: legacy["document-uri"] ?? null,
      violatedDirective: legacy["violated-directive"] ?? null,
      effectiveDirective: legacy["effective-directive"] ?? null,
      blockedUri: legacy["blocked-uri"] ?? null,
      sourceFile: legacy["source-file"] ?? null,
      lineNumber: legacy["line-number"] ?? null,
      disposition: legacy.disposition ?? null,
      referrer: legacy.referrer ?? null,
    };
  }

  // Modern Reporting API. Payload is an array of report objects; take
  // the first one if the array wrapper made it here.
  const first = Array.isArray(payload) ? (payload[0] as ModernCspReport) : (payload as ModernCspReport);
  const body = first?.body;
  if (body) {
    return {
      variant: "reports-api",
      documentUri: body.documentURL ?? null,
      violatedDirective: body.violatedDirective ?? null,
      effectiveDirective: body.effectiveDirective ?? null,
      blockedUri: body.blockedURL ?? null,
      sourceFile: body.sourceFile ?? null,
      lineNumber: body.lineNumber ?? null,
      disposition: body.disposition ?? null,
      referrer: body.referrer ?? null,
      userAgent: first.user_agent ?? null,
      url: first.url ?? null,
    };
  }

  return null;
}

export async function POST(req: Request) {
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    // Malformed JSON — silently drop. Browser doesn't retry regardless.
    return new NextResponse(null, { status: 204 });
  }

  const normalised = normaliseReport(payload);
  if (!normalised) return new NextResponse(null, { status: 204 });

  logger.warn(
    { event: "csp.report_only.violation", ...normalised },
    "CSP violation reported",
  );

  return new NextResponse(null, { status: 204 });
}

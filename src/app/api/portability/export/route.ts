import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { recordAudit } from "@/lib/audit/log";
import { buildCompanyExport } from "@/lib/portability/export";
import { requireCurrentCompanyId } from "@/lib/db/tenant";

/**
 * T-032 — GET returns a JSON snapshot of every row owned by the caller's
 * tenant. Only admins may trigger the download; workers and unauthenticated
 * callers get a 401.
 *
 * Payloads can be large. Callers on huge tenants should stream the response
 * to disk rather than parsing it in memory — the response body itself is
 * a plain `application/json`.
 */
export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  let companyProfileId: string;
  try {
    companyProfileId = await requireCurrentCompanyId();
  } catch {
    return NextResponse.json({ ok: false, message: "No tenant on session." }, { status: 401 });
  }

  const snapshot = await buildCompanyExport(companyProfileId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `redionflow-export-${companyProfileId}-${stamp}.json`;

  // T-033: audit the export so the tenant can see when a snapshot was pulled.
  await recordAudit({
    companyProfileId,
    actorType: "ADMIN",
    actorId: admin.id,
    action: "data_export.downloaded",
    payload: {
      rowCount: Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0),
      fileUrlCount: snapshot.files.urls.length,
    },
  }).catch((error) => {
    console.error("[portability.export] audit failed", error);
  });

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

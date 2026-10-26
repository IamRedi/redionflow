import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { requireCurrentCompanyId } from "@/lib/db/tenant";
import { buildBaustelleExportZip } from "@/lib/export/baustelle-export";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ baustelleId: string }> },
) {
  const currentLang = await resolveRequestLanguage();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response(t("workzone.loginRequired", currentLang), { status: 401 });
  }

  let companyProfileId: string;
  try {
    companyProfileId = await requireCurrentCompanyId();
  } catch {
    return new Response(t("workzone.loginRequired", currentLang), { status: 401 });
  }
  const { baustelleId } = await params;
  const archive = await buildBaustelleExportZip(baustelleId, companyProfileId, currentLang);
  if (!archive) {
    return new Response(t("workzone.siteNotFound", currentLang), { status: 404 });
  }

  return new Response(archive.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.archiveName}"`,
      "Cache-Control": "no-store",
    },
  });
}

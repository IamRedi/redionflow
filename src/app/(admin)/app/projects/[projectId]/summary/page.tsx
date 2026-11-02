import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print/PrintButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { calculatePositionTotals } from "@/lib/calculation/position";
import { calculateProjectTotals } from "@/lib/calculation/project";
import { positionDirectCostsFromDb } from "@/lib/calculation/position-from-db";
import { overheadSettingsToEngine } from "@/lib/calculation/overhead-map";
import { formatMoney } from "@/lib/calculation/formatters";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { getCompanyCountry } from "@/lib/db/company";
import { regionConfig } from "@/lib/region";

export default async function ProjectSummaryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [currentCompanyId, currentLang] = await Promise.all([getCurrentCompanyId(), resolveRequestLanguage()]);
  const currency = regionConfig(await getCompanyCountry()).currency;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      companyProfile: true,
      positions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          laborItems: { include: { laborRole: true } },
          machineItems: { include: { machine: true } },
          materialItems: true,
          externalServiceItems: true,
        },
      },
    },
  });

  if (!project || !currentCompanyId || project.companyProfileId !== currentCompanyId) notFound();

  const overheadFull = await prisma.overheadSettings.findUnique({
    where: { companyProfileId: project.companyProfileId },
  });
  const overhead = overheadSettingsToEngine(overheadFull);

  const directs = project.positions.map((p) => positionDirectCostsFromDb(p));
  const projectCalc = calculateProjectTotals(directs, overhead, { applyVat: overhead.applyVatByDefault });

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link href={`/app/projects/${projectId}`}>{t("form.backToProject")}</Link>
        </Button>
        <PrintButton />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.quoteOverview")}</div>
          <CardTitle className="text-2xl">{project.title}</CardTitle>
          <CardDescription>
            {project.companyProfile.displayName} · {project.customerName}
            {project.customerCity ? ` · ${project.customerZip ?? ""} ${project.customerCity}`.trim() : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("form.customer")}</span>
              <span className="text-right font-medium">{project.customerName}</span>
            </div>
            {project.customerStreet ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("common.address")}</span>
                <span className="text-right">
                  {project.customerStreet}
                  <br />
                  {project.customerZip} {project.customerCity}
                </span>
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">{t("form.positions")}</h2>
            {project.positions.map((pos, idx) => {
              const direct = positionDirectCostsFromDb(pos);
              const pt = calculatePositionTotals(direct, overhead, { applyVat: overhead.applyVatByDefault });
              return (
                <div key={pos.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium">
                      {idx + 1}. {pos.title}
                    </div>
                    <div className="tabular-nums text-sm font-semibold">{formatMoney(pt.offer.netCents, currentLang, currency)} {t("form.net")}</div>
                  </div>
                  {pos.description ? <p className="mt-1 text-sm text-muted-foreground">{pos.description}</p> : null}
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                    <div>{t("form.costEk")}: {formatMoney(pt.direct.ekCents, currentLang, currency)}</div>
                    <div>{t("form.costHk")}: {formatMoney(pt.overhead.hkCents, currentLang, currency)}</div>
                    <div>{t("form.costSk")}: {formatMoney(pt.overhead.skCents, currentLang, currency)}</div>
                    <div>
                      {t("form.vatGross")}: {formatMoney(pt.offer.vatCents, currentLang, currency)} / {formatMoney(pt.offer.grossCents, currentLang, currency)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("form.total")}</h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("form.sumNet")}</span>
                <span className="tabular-nums font-semibold">{formatMoney(projectCalc.sum.netCents, currentLang, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("form.vat")}</span>
                <span className="tabular-nums">{formatMoney(projectCalc.sum.vatCents, currentLang, currency)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>{t("form.gross")}</span>
                <span className="tabular-nums">{formatMoney(projectCalc.sum.grossCents, currentLang, currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


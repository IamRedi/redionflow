import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { unitLabel } from "@/lib/calculation/formatters";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { finishProjectAction } from "../../actions";

export default async function ProjectExecutionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, currentLang, currentCompanyId] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        positions: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            laborItems: true,
            machineItems: true,
            materialItems: true,
            externalServiceItems: true,
          },
        },
      },
    }),
    resolveRequestLanguage(),
    getCurrentCompanyId(),
  ]);

  if (!project || !currentCompanyId || project.companyProfileId !== currentCompanyId) notFound();
  const t = getTranslator(currentLang);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/app/projects">{t("admin.backHome")}</Link>
          </Button>
          <h1 className="mt-2 text-xl font-semibold">{t("admin.execution")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.title} · {project.customerName}
          </p>
        </div>
        <form action={finishProjectAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <Button type="submit">{t("admin.finish")}</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.executionPlanNoPrices")}</CardTitle>
          <CardDescription>{t("admin.executionPlanNoPricesSub")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("form.customer")}</div>
              <div className="mt-1 font-medium">{project.customerName}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("common.address")}</div>
              <div className="mt-1">
                {project.customerStreet ?? t("admin.addressOpen")}
                {project.customerZip || project.customerCity ? (
                  <>
                    <br />
                    {project.customerZip} {project.customerCity}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {project.positions.map((position, index) => (
          <Card key={position.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {index + 1}. {position.title}
              </CardTitle>
              {position.description ? <CardDescription>{position.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <ExecutionBlock title={t("admin.workersWages")} emptyLabel={t("admin.noInformation")} rows={position.laborItems.map((row) => `${row.laborRoleNameSnapshot}: ${row.workers} ${t("admin.peopleShort")} · ${row.hours.toString()} h`)} />
              <ExecutionBlock title={t("admin.machines")} emptyLabel={t("admin.noInformation")} rows={position.machineItems.map((row) => `${row.machineNameSnapshot}: ${row.quantity.toString()} ${row.timeUnit === "DAYS" ? t("admin.daysShort") : "h"}`)} />
              <ExecutionBlock title={t("form.material")} emptyLabel={t("admin.noInformation")} rows={position.materialItems.map((row) => `${row.title}: ${row.quantity.toString()} ${unitLabel(row.unit, currentLang)}`)} />
              <ExecutionBlock title={t("form.externalServices")} emptyLabel={t("admin.noInformation")} rows={position.externalServiceItems.map((row) => row.title)} />
              <div className="rounded-md border border-dashed p-3 lg:col-span-2">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("admin.notesExtraWork")}</div>
                <div className="mt-8 border-t pt-2 text-xs text-muted-foreground">{t("admin.completeOnSite")}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExecutionBlock({ title, rows, emptyLabel }: { title: string; rows: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

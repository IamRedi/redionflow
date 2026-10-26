import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateProjectTotals } from "@/lib/calculation/project";
import { formatEUR } from "@/lib/calculation/formatters";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { overheadSettingsToEngine } from "@/lib/calculation/overhead-map";
import { positionDirectCostsFromDb } from "@/lib/calculation/position-from-db";
import { prisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { CreateProjectForm } from "./create-project-form";
import { finishProjectAction, openProjectExecutionAction } from "./actions";

function statusLabel(status: string, translate: (path: string) => string) {
  if (status === "DRAFT") return translate("form.statusDraft");
  if (status === "IN_REVIEW") return translate("form.statusReview");
  if (status === "SENT") return translate("form.statusSent");
  if (status === "ACCEPTED") return translate("form.statusExecution");
  if (status === "LOST") return translate("form.statusLost");
  if (status === "ARCHIVED") return translate("form.statusFinished");
  return status;
}

function statusClass(status: string) {
  if (status === "ARCHIVED") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (status === "ACCEPTED") return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200";
  if (status === "SENT") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  if (status === "LOST") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200";
  return "border-muted-foreground/25 bg-muted text-muted-foreground";
}

export default async function ProjectsPage() {
  const [company, mode, currentLang] = await Promise.all([
    getOrCreateDefaultCompany(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const tr = getTranslator(currentLang, mode);
  const [projects, overheadFull] = await Promise.all([
    prisma.project.findMany({
      where: { companyProfileId: company.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        positions: {
          include: {
            laborItems: { include: { laborRole: true } },
            machineItems: { include: { machine: true } },
            materialItems: true,
            externalServiceItems: true,
          },
        },
      },
    }),
    prisma.overheadSettings.findUnique({ where: { companyProfileId: company.id } }),
  ]);
  const overhead = overheadSettingsToEngine(overheadFull);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{tr("admin.home")}</div>
          <h1 className="mt-1 text-xl font-semibold">{tr("admin.projectsHeading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("admin.projectsSubtitle")}</p>
        </div>
        <div className="text-sm text-muted-foreground">{projects.length}</div>
      </div>

      <CreateProjectForm companyId={company.id} />

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => {
          const totals = calculateProjectTotals(project.positions.map((position) => positionDirectCostsFromDb(position)), overhead, {
            applyVat: overhead.applyVatByDefault,
          });
          const location = [project.customerZip, project.customerCity].filter(Boolean).join(" ");

          return (
            <Card
              key={project.id}
              className={`overflow-hidden ${project.status === "ACCEPTED" ? "border-sky-500/40" : project.status === "ARCHIVED" ? "border-emerald-500/40" : ""}`}
            >
              <CardContent className="flex min-h-64 flex-col p-0">
                <div className="flex-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClass(project.status)}`}>{statusLabel(project.status, tr)}</span>
                    <span className="text-xs text-muted-foreground">{tr("form.positionsCount").replace("{count}", project.positions.length.toLocaleString(currentLang === "de" ? "de-DE" : currentLang))}</span>
                  </div>

                  <h2 className="mt-4 line-clamp-2 text-lg font-semibold">{project.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.customerName}
                    {location ? ` · ${location}` : ""}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{tr("form.net")}</div>
                      <div className="mt-1 tabular-nums font-semibold">{formatEUR(totals.sum.netCents, currentLang)}</div>
                    </div>
                    <div className="rounded-md border bg-muted/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{tr("form.gross")}</div>
                      <div className="mt-1 tabular-nums font-semibold">{formatEUR(totals.sum.grossCents, currentLang)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t bg-muted/15 p-3">
                  <Button asChild size="sm">
                    <Link href={`/app/projects/${project.id}`}>{tr("form.calculation")}</Link>
                  </Button>
                  <form action={openProjectExecutionAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <Button type="submit" size="sm" variant="secondary">{tr("admin.execution")}</Button>
                  </form>
                  <form action={finishProjectAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <Button type="submit" size="sm" variant="outline">{tr("admin.finish")}</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-md border bg-muted/20 py-6 text-center text-sm text-muted-foreground">{tr("form.noProjects")}</p>
      ) : null}
    </div>
  );
}

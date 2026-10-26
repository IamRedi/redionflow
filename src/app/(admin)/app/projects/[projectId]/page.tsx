import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { calculatePositionTotals } from "@/lib/calculation/position";
import { positionDirectCostsFromDb } from "@/lib/calculation/position-from-db";
import { overheadSettingsToEngine } from "@/lib/calculation/overhead-map";
import { formatEUR } from "@/lib/calculation/formatters";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { ProjectMetaForm } from "./project-meta-form";
import { ApplyTemplateForm } from "./apply-template-form";
import { RecipeBuilder } from "./recipe-builder";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, currentLang, currentCompanyId] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        companyProfile: { include: { overheadSettings: true } },
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
    }),
    resolveRequestLanguage(),
    getCurrentCompanyId(),
  ]);
  if (!project || !currentCompanyId || project.companyProfileId !== currentCompanyId) notFound();
  const translate = getTranslator(currentLang);

  const templates = await prisma.calculationTemplate.findMany({
    where: { companyProfileId: project.companyProfileId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const overhead = overheadSettingsToEngine(project.companyProfile.overheadSettings);

  async function addPosition() {
    "use server";
    await requireAdminTenant();
    const actionCompanyId = await getCurrentCompanyId();
    const ownedProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyProfileId: true },
    });
    if (!actionCompanyId || !ownedProject || ownedProject.companyProfileId !== actionCompanyId) return;
    const count = await prisma.projectPosition.count({ where: { projectId } });
    await prisma.projectPosition.create({
      data: {
        projectId,
        title: `Position ${count + 1}`,
        sortOrder: count,
        quantity: 1,
        unit: "pauschal",
      },
    });
    revalidatePath(`/app/projects/${projectId}`);
  }

  let projectNet = 0;
  for (const pos of project.positions) {
    const direct = positionDirectCostsFromDb(pos);
    const t = calculatePositionTotals(direct, overhead, { applyVat: overhead.applyVatByDefault });
    projectNet += t.offer.netCents;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{translate("form.project")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.customerName} · {translate("form.projectNetSumPositions")}:{" "}
            <span className="font-medium text-foreground">{formatEUR(projectNet, currentLang)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/app/projects/${projectId}/summary`}>{translate("form.projectSummary")}</Link>
          </Button>
          <form action={addPosition}>
            <Button type="submit">{translate("form.addPosition")}</Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translate("form.masterData")}</CardTitle>
          <CardDescription>{translate("form.projectAndCustomerData")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectMetaForm
            defaultValues={{
              projectId: project.id,
              title: project.title,
              customerName: project.customerName,
              customerStreet: project.customerStreet ?? undefined,
              customerZip: project.customerZip ?? undefined,
              customerCity: project.customerCity ?? undefined,
              internalNotes: project.internalNotes ?? undefined,
              status: project.status,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate("admin.recipeNewCalculationTitle")}</CardTitle>
          <CardDescription>{translate("admin.recipeNewCalculationDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RecipeBuilder projectId={projectId} currentLang={currentLang} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate("form.templates")}</CardTitle>
          <CardDescription>{translate("form.templatesApplyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ApplyTemplateForm projectId={projectId} templates={templates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate("form.positions")}</CardTitle>
          <CardDescription>{translate("form.positionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("form.title")}</TableHead>
                <TableHead className="text-right">{translate("form.netPosition")}</TableHead>
                <TableHead className="text-right">{translate("form.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.positions.map((pos) => {
                const direct = positionDirectCostsFromDb(pos);
                const t = calculatePositionTotals(direct, overhead, { applyVat: overhead.applyVatByDefault });
                return (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEUR(t.offer.netCents, currentLang)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/app/projects/${projectId}/positions/${pos.id}`}>{translate("common.edit")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {project.positions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{translate("form.noPositions")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


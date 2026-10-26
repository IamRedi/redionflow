import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BreakdownPanel } from "@/components/calculation/BreakdownPanel";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { decimalToNumber } from "@/lib/db/prisma-types";
import { calculatePositionTotals } from "@/lib/calculation/position";
import { positionDirectCostsFromDb } from "@/lib/calculation/position-from-db";
import { overheadSettingsToEngine } from "@/lib/calculation/overhead-map";
import { formatEUR } from "@/lib/calculation/formatters";
import { EXTERNAL_SERVICE_PRESETS, externalServiceGroupLabel, externalServiceTitle } from "@/lib/external-services/catalog";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { MACHINE_CATEGORY_OPTIONS, machineOptionLabel, type MachineCategoryCode, type MachineListOption } from "@/lib/machines/display";
import { MATERIAL_PRESETS, materialGroupLabel, materialPresetTitle } from "@/lib/materials/catalog";
import { laborRowDirectCents, machineRowDirectCents, materialRowDirectCents } from "@/lib/calculation/compute-position-direct";
import {
  addExternalRow,
  addLaborRow,
  addMachineRow,
  addMaterialRow,
  deleteExternalRow,
  deleteLaborRow,
  deleteMachineRow,
  deleteMaterialRow,
  updateExternalRow,
  updateLaborRow,
  updateMachineRow,
  updateMaterialRow,
  updatePositionMeta,
} from "./actions";

function machineCategoryLabel(category: MachineCategoryCode, t: (path: string) => string) {
  return t(`form.machineCategory.${category}`);
}

function MachineOptionGroups({ machines, t }: { machines: MachineListOption[]; t: (path: string) => string }) {
  return (
    <>
      {MACHINE_CATEGORY_OPTIONS.map((category) => {
        const rows = machines.filter((machine) => (machine.category ?? "OTHER") === category.value);
        if (rows.length === 0) return null;
        return (
          <optgroup key={category.value} label={machineCategoryLabel(category.value, t)}>
            {rows.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machineOptionLabel(machine)}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

function machineChoices(activeMachines: MachineListOption[], selectedMachine?: MachineListOption | null) {
  if (!selectedMachine || activeMachines.some((machine) => machine.id === selectedMachine.id)) return activeMachines;
  return [...activeMachines, selectedMachine];
}

function MaterialQuickAdd({
  projectId,
  positionId,
  currentLang,
  t,
}: {
  projectId: string;
  positionId: string;
  currentLang: string;
  t: (path: string) => string;
}) {
  const groups = Array.from(new Set(MATERIAL_PRESETS.map((preset) => preset.group)));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => {
        const presets = MATERIAL_PRESETS.filter((preset) => preset.group === group);
        return (
          <div key={group} className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{materialGroupLabel(group, currentLang)}</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <form key={preset.title} action={addMaterialRow}>
                  <input type="hidden" name="positionId" value={positionId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="title" value={materialPresetTitle(preset.title, currentLang)} />
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="unit" value={preset.unit} />
                  <input type="hidden" name="unitPriceEur" value={preset.unitPriceEur} />
                  <Button type="submit" variant="outline" size="sm" className="h-auto py-2 text-left">
                    <span>
                      <span className="block text-xs font-medium">{materialPresetTitle(preset.title, currentLang)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {preset.unitPriceEur} {t("form.currencyEurPerUnit").replace("{unit}", preset.unit)}
                      </span>
                    </span>
                  </Button>
                </form>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExternalServiceQuickAdd({
  projectId,
  positionId,
  currentLang,
  t,
}: {
  projectId: string;
  positionId: string;
  currentLang: string;
  t: (path: string) => string;
}) {
  const groups = Array.from(new Set(EXTERNAL_SERVICE_PRESETS.map((preset) => preset.group)));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => {
        const presets = EXTERNAL_SERVICE_PRESETS.filter((preset) => preset.group === group);
        return (
          <div key={group} className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{externalServiceGroupLabel(group, currentLang)}</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <form key={preset.title} action={addExternalRow}>
                  <input type="hidden" name="positionId" value={positionId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="title" value={externalServiceTitle(preset.title, currentLang)} />
                  <input type="hidden" name="amountEur" value={preset.amountEur} />
                  <Button type="submit" variant="outline" size="sm" className="h-auto py-2 text-left">
                    <span>
                      <span className="block text-xs font-medium">{externalServiceTitle(preset.title, currentLang)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {preset.amountEur} {t("form.currencyEur")}
                      </span>
                    </span>
                  </Button>
                </form>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function PositionEditPage({ params }: { params: Promise<{ projectId: string; positionId: string }> }) {
  const [{ projectId, positionId }, currentLang, currentCompanyId] = await Promise.all([
    params,
    resolveRequestLanguage(),
    getCurrentCompanyId(),
  ]);
  const t = getTranslator(currentLang);

  const position = await prisma.projectPosition.findUnique({
    where: { id: positionId },
    include: {
      project: { include: { companyProfile: { include: { overheadSettings: true } } } },
      laborItems: { include: { laborRole: true }, orderBy: { createdAt: "asc" } },
      machineItems: { include: { machine: true }, orderBy: { createdAt: "asc" } },
      materialItems: { orderBy: { createdAt: "asc" } },
      externalServiceItems: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!position) notFound();
  if (position.projectId !== projectId) notFound();
  if (!currentCompanyId || position.project.companyProfileId !== currentCompanyId) notFound();
  const pos = position;

  const companyId = pos.project.companyProfileId;
  const laborRoles = await prisma.laborRole.findMany({
    where: { companyProfileId: companyId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const machines = await prisma.machine.findMany({
    where: { companyProfileId: companyId, isActive: true },
    orderBy: [{ category: "asc" }, { nickname: "asc" }, { name: "asc" }],
  });

  const overhead = overheadSettingsToEngine(pos.project.companyProfile.overheadSettings);
  const direct = positionDirectCostsFromDb(pos);
  const totals = calculatePositionTotals(direct, overhead, { applyVat: overhead.applyVatByDefault });

  const qtyStr = decimalToNumber(pos.quantity as never).toString();

  function laborRowCents(row: (typeof pos.laborItems)[number]) {
    return laborRowDirectCents({
      workers: row.workers,
      hours: row.hours,
      hourlyRateOverrideCents: row.hourlyRateOverrideCents,
      laborRole: row.laborRole
        ? {
            wageType: row.laborRole.wageType,
            grossHourlyCents: row.laborRole.grossHourlyCents,
            grossMonthlyCents: row.laborRole.grossMonthlyCents,
            employerOverheadPct: row.laborRole.employerOverheadPct,
            productivityPct: row.laborRole.productivityPct,
            absencePct: row.laborRole.absencePct,
          }
        : null,
    });
  }

  function machineRowCents(row: (typeof pos.machineItems)[number]) {
    return machineRowDirectCents({
      timeUnit: row.timeUnit,
      quantity: row.quantity,
      rateOverrideCents: row.rateOverrideCents,
      machine: row.machine ? { hourlyRateCents: row.machine.hourlyRateCents, dayRateCents: row.machine.dayRateCents } : null,
    });
  }

  function materialRowCents(row: (typeof pos.materialItems)[number]) {
    return materialRowDirectCents({
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link className="hover:underline" href={`/app/projects/${projectId}`}>
              {t("form.backToProject")}
            </Link>
          </div>
          <h1 className="text-xl font-semibold">{t("form.positionEdit")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pos.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/app/projects/${projectId}/summary`}>{t("form.toOverview")}</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("form.position")}</CardTitle>
              <CardDescription>{t("form.positionMetaDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePositionMeta} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="positionId" value={pos.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="title">{t("form.title")}</Label>
                  <Input id="title" name="title" defaultValue={pos.title} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="description">{t("form.description")}</Label>
                  <Textarea id="description" name="description" defaultValue={pos.description ?? ""} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">{t("form.quantity")}</Label>
                  <Input id="quantity" name="quantity" inputMode="decimal" defaultValue={qtyStr} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit">{t("form.unit")}</Label>
                  <Input id="unit" name="unit" defaultValue={pos.unit} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="notes">{t("form.notes")}</Label>
                  <Textarea id="notes" name="notes" defaultValue={pos.notes ?? ""} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manualAdjustmentEur">{t("form.manualAdjustmentEur")}</Label>
                  <Input
                    id="manualAdjustmentEur"
                    name="manualAdjustmentEur"
                    inputMode="decimal"
                    defaultValue={((pos.manualAdjustmentCents ?? 0) / 100).toFixed(2)}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit">{t("common.save")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("form.labor")}</CardTitle>
              <CardDescription>{t("form.laborInputDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.roleInput")}</TableHead>
                    <TableHead className="text-right">{t("form.direct")}</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.laborItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <form action={updateLaborRow} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <div className="min-w-[200px] space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.role")}</Label>
                            <select
                              name="laborRoleId"
                              defaultValue={row.laborRoleId ?? ""}
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              {laborRoles.map((lr) => (
                                <option key={lr.id} value={lr.id}>
                                  {lr.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-20 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.workerCountShort")}</Label>
                            <Input name="workers" defaultValue={row.workers} />
                          </div>
                          <div className="w-24 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.hoursShort")}</Label>
                            <Input name="hours" defaultValue={decimalToNumber(row.hours as never)} />
                          </div>
                          <div className="w-28 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.hourlyOverride")}</Label>
                            <Input
                              name="overrideEur"
                              placeholder={t("form.noValue")}
                              defaultValue={row.hourlyRateOverrideCents != null ? (row.hourlyRateOverrideCents / 100).toFixed(2) : ""}
                            />
                          </div>
                          <Button type="submit" size="sm" variant="secondary">
                            {t("common.save")}
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top pt-8">{formatEUR(laborRowCents(row), currentLang)}</TableCell>
                      <TableCell className="text-right align-top pt-6">
                        <form action={deleteLaborRow}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Button type="submit" variant="destructive" size="sm">
                            {t("common.delete")}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {laborRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("form.noActiveLaborRoles")}</p>
              ) : (
                <form action={addLaborRow} className="grid gap-3 md:grid-cols-6">
                  <input type="hidden" name="positionId" value={positionId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>{t("form.role")}</Label>
                    <select name="laborRoleId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      {laborRoles.map((lr) => (
                        <option key={lr.id} value={lr.id}>
                          {lr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.workerCountShort")}</Label>
                    <Input name="workers" defaultValue="1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.unitHours")}</Label>
                    <Input name="hours" defaultValue="1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.hourlyOverride")}</Label>
                    <Input name="overrideEur" placeholder={t("form.overrideOptional")} />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full">
                      {t("form.addLine")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.machines")}</CardTitle>
              <CardDescription>{t("form.machineOverrideDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.machineInput")}</TableHead>
                    <TableHead className="text-right">{t("form.direct")}</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.machineItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <form action={updateMachineRow} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <div className="min-w-[200px] space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("workzone.machine")}</Label>
                            <select
                              name="machineId"
                              defaultValue={row.machineId ?? ""}
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              <MachineOptionGroups machines={machineChoices(machines, row.machine)} t={t} />
                            </select>
                          </div>
                          <div className="w-36 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.unit")}</Label>
                            <select name="timeUnit" defaultValue={row.timeUnit} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                              <option value="HOURS">{t("form.unitHours")}</option>
                              <option value="DAYS">{t("form.unitDays")}</option>
                            </select>
                          </div>
                          <div className="w-28 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.quantity")}</Label>
                            <Input name="quantity" defaultValue={decimalToNumber(row.quantity as never)} />
                          </div>
                          <div className="w-32 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("form.unitOverride")}</Label>
                            <Input
                              name="overrideEur"
                              placeholder={t("form.noValue")}
                              defaultValue={row.rateOverrideCents != null ? (row.rateOverrideCents / 100).toFixed(2) : ""}
                            />
                          </div>
                          <Button size="sm" type="submit" variant="secondary">
                            {t("common.save")}
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top pt-8">{formatEUR(machineRowCents(row), currentLang)}</TableCell>
                      <TableCell className="text-right align-top pt-6">
                        <form action={deleteMachineRow}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Button type="submit" variant="destructive" size="sm">
                            {t("common.delete")}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {machines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("form.noMachinesCreateFirst")}</p>
              ) : (
                <form action={addMachineRow} className="grid gap-3 md:grid-cols-6">
                  <input type="hidden" name="positionId" value={positionId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>{t("workzone.machine")}</Label>
                    <select name="machineId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      <MachineOptionGroups machines={machines} t={t} />
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.unit")}</Label>
                    <select name="timeUnit" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="HOURS">{t("form.unitHours")}</option>
                      <option value="DAYS">{t("form.unitDays")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.quantity")}</Label>
                    <Input name="quantity" defaultValue="1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("form.unitOverride")}</Label>
                    <Input name="overrideEur" placeholder={t("form.overrideOptional")} />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full">
                      {t("form.addLine")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("form.material")}</CardTitle>
              <CardDescription>{t("form.materialQuickAddDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MaterialQuickAdd projectId={projectId} positionId={positionId} currentLang={currentLang} t={t} />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.designationInput")}</TableHead>
                    <TableHead className="text-right">{t("form.direct")}</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.materialItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <form action={updateMaterialRow} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Input name="title" className="min-w-[200px]" defaultValue={row.title} />
                          <Input name="quantity" className="w-24" defaultValue={decimalToNumber(row.quantity as never)} />
                          <Input name="unit" className="w-24" defaultValue={row.unit} />
                          <Input name="unitPriceEur" className="w-28" defaultValue={(row.unitPriceCents / 100).toFixed(2)} />
                          <Button size="sm" type="submit" variant="secondary">
                            {t("common.save")}
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-right tabular-nums align-top pt-8">{formatEUR(materialRowCents(row), currentLang)}</TableCell>
                      <TableCell className="text-right align-top pt-6">
                        <form action={deleteMaterialRow}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Button type="submit" variant="destructive" size="sm">
                            {t("common.delete")}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <form action={addMaterialRow} className="grid gap-3 md:grid-cols-6">
                <input type="hidden" name="positionId" value={positionId} />
                <input type="hidden" name="projectId" value={projectId} />
                <div className="md:col-span-2 space-y-1.5">
                  <Label>{t("form.materialName")}</Label>
                  <Input name="title" list="material-preset-titles" placeholder={t("form.materialNameExample")} />
                  <datalist id="material-preset-titles">
                    {MATERIAL_PRESETS.map((preset) => (
                      <option key={preset.title} value={materialPresetTitle(preset.title, currentLang)} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("form.quantity")}</Label>
                  <Input name="quantity" defaultValue="1" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("form.unit")}</Label>
                  <Input name="unit" defaultValue={t("form.unitDefault")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("form.unitPrice")}</Label>
                  <Input name="unitPriceEur" defaultValue="0" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    {t("form.addLine")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("form.externalServices")}</CardTitle>
              <CardDescription>{t("form.externalServicesQuickAddDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ExternalServiceQuickAdd projectId={projectId} positionId={positionId} currentLang={currentLang} t={t} />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("form.title")}</TableHead>
                    <TableHead className="text-right">{t("form.amount")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.externalServiceItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <form action={updateExternalRow} className="flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Input name="title" defaultValue={row.title} className="max-w-xs" />
                          <Input name="amountEur" defaultValue={(row.amountCents / 100).toFixed(2)} className="w-28" />
                          <Button size="sm" type="submit" variant="secondary">
                            {t("form.update")}
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(row.amountCents, currentLang)}</TableCell>
                      <TableCell className="text-right">
                        <form action={deleteExternalRow}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="positionId" value={positionId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <Button type="submit" variant="destructive" size="sm">
                            {t("common.delete")}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <form action={addExternalRow} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="positionId" value={positionId} />
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("form.title")}</Label>
                  <Input name="title" list="external-service-preset-titles" placeholder={t("form.externalServiceExample")} />
                  <datalist id="external-service-preset-titles">
                    {EXTERNAL_SERVICE_PRESETS.map((preset) => (
                      <option key={preset.title} value={externalServiceTitle(preset.title, currentLang)} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("form.amountEur")}</Label>
                  <Input name="amountEur" defaultValue="0" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    {t("form.addLine")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <BreakdownPanel title={t("form.calculationPosition")} totals={totals} t={t} currentLang={currentLang} />
          <Card>
            <CardHeader>
              <CardTitle>{t("common.note")}</CardTitle>
              <CardDescription>
                {t("form.saveHintRefresh")}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}


import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

function localeForLanguage(lang: string) {
  return lang === "de" ? "de-DE" : lang;
}

function dateValue(date: Date | null, lang: string) {
  return date ? date.toLocaleDateString(localeForLanguage(lang)) : "-";
}

function dateTimeValue(date: Date, lang: string) {
  return date.toLocaleString(localeForLanguage(lang));
}

export default async function DemoMachineDetailPage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params;
  const currentLang = await resolveRequestLanguage();
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) notFound();

  const history = await prisma.machineConeMovement.findMany({
    where: {
      OR: [{ fromMachineId: machine.id }, { toMachineId: machine.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      baustelle: { select: { id: true, name: true } },
      fromMachine: { select: { nickname: true, name: true } },
      toMachine: { select: { nickname: true, name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/demo/workzone">
              <ArrowLeft className="size-4" />
              {t("common.back", currentLang)}
            </Link>
          </Button>
          <h1 className="mt-2 text-xl font-semibold">{machine.nickname ?? machine.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {machine.targe ?? t("workzone.noLicensePlate", currentLang)} · {machine.funksioni ?? t("workzone.fleet", currentLang)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DemoReadonlyBadge />
          {machine.imageUrl ? (
            <img src={machine.imageUrl} alt={machine.nickname ?? machine.name} className="h-20 w-28 rounded-md border object-cover" />
          ) : (
            <div className="flex h-20 w-28 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
              {t("common.photo", currentLang)}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("admin.masterData", currentLang)}</CardTitle>
          <CardDescription>{t("admin.demoMachineProfileDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("admin.internalName", currentLang)}</div>
            <div className="font-medium">{machine.nickname ?? machine.name}</div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <div className="text-xs text-muted-foreground">{t("admin.modelDescription", currentLang)}</div>
            <div className="font-medium">{machine.model ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("workzone.licensePlate", currentLang)}</div>
            <div className="font-medium">{machine.targe ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("workzone.function", currentLang)}</div>
            <div className="font-medium">{machine.funksioni ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("workzone.requiredLicense", currentLang)}</div>
            <div className="font-medium">{machine.patentaEnevojshme ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("workzone.productionYear", currentLang)}</div>
            <div className="font-medium">{machine.vitiProdhimit ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("workzone.purchaseYear", currentLang)}</div>
            <div className="font-medium">{machine.vitiBlerjes ?? "-"}</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("common.active", currentLang)}</div>
            <div className="font-medium">{machine.isActive ? "Ja" : "Nein"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("admin.inspections", currentLang)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">HU</div><div className="font-medium">{dateValue(machine.tuvDate, currentLang)}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("admin.huStatus", currentLang)}</div><div className="font-medium">{machine.huStatus ?? "-"}</div></div>
          <div />
          <div><div className="text-xs text-muted-foreground">SP</div><div className="font-medium">{dateValue(machine.spDate, currentLang)}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("admin.spStatus", currentLang)}</div><div className="font-medium">{machine.spStatus ?? "-"}</div></div>
          <div />
          <div><div className="text-xs text-muted-foreground">UVV</div><div className="font-medium">{dateValue(machine.uvvDate, currentLang)}</div></div>
          <div><div className="text-xs text-muted-foreground">{t("admin.uvvStatus", currentLang)}</div><div className="font-medium">{machine.uvvStatus ?? "-"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">{t("workzone.cones", currentLang)}</CardTitle>
          <CardDescription>{t("admin.demoRecentMovementDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-md border p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.time", currentLang)}</TableHead>
                <TableHead>{t("common.type", currentLang)}</TableHead>
                <TableHead>{t("common.quantity", currentLang)}</TableHead>
                <TableHead>{t("report.siteLocation", currentLang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">{t("common.none", currentLang)}</TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{dateTimeValue(row.createdAt, currentLang)}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>
                      {row.baustelle ? <Link className="hover:underline" href={`/demo/baustellen/${row.baustelle.id}`}>{row.baustelle.name}</Link> : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {machine.notes ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">{t("form.notes", currentLang)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm">{machine.notes}</div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

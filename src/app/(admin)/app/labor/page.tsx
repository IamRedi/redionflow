import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { decimalToNumber } from "@/lib/db/prisma-types";
import { prisma } from "@/lib/db/prisma";
import { effectiveLaborHourlyCost } from "@/lib/calculation/labor";
import { t } from "@/lib/i18n";

export default async function LaborRolesPage() {
  const company = await getOrCreateDefaultCompany();
  const roles = await prisma.laborRole.findMany({
    where: { companyProfileId: company.id },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  async function create(formData: FormData) {
    "use server";
    const companyProfileId = await requireAdminTenant();
    const companyId = String(formData.get("companyId") ?? "");
    if (companyId !== companyProfileId) return;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    const wageType = String(formData.get("wageType") ?? "HOURLY") as "HOURLY" | "MONTHLY";
    const grossHourlyCents = Math.round(Number(formData.get("grossHourlyEur") ?? 0) * 100);
    const grossMonthlyCents = Math.round(Number(formData.get("grossMonthlyEur") ?? 0) * 100);

    const employerOverheadPct = Number(formData.get("employerOverheadPct") ?? 0) / 100;
    const productivityPct = Number(formData.get("productivityPct") ?? 0) / 100;
    const absencePct = Number(formData.get("absencePct") ?? 0) / 100;

    await prisma.laborRole.create({
      data: {
        companyProfileId,
        name,
        wageType,
        grossHourlyCents: wageType === "HOURLY" ? grossHourlyCents : null,
        grossMonthlyCents: wageType === "MONTHLY" ? grossMonthlyCents : null,
        employerOverheadPct,
        productivityPct,
        absencePct,
        isActive: true,
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("form.laborRoles")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("form.laborRolesDescription")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.newLaborRole")}</CardTitle>
          <CardDescription>{t("form.valuesEurPercentExample")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={create} className="grid gap-4 md:grid-cols-6">
            <input type="hidden" name="companyId" value={company.id} />

            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="name">{t("form.roleName")}</Label>
              <Input id="name" name="name" placeholder={t("form.laborRoleExample")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wageType">{t("form.wageType")}</Label>
              <select
                id="wageType"
                name="wageType"
                defaultValue="HOURLY"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="HOURLY">{t("form.hourlyWage")}</option>
                <option value="MONTHLY">{t("form.monthlyWage")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grossHourlyEur">{t("form.grossHourly")}</Label>
              <Input id="grossHourlyEur" name="grossHourlyEur" inputMode="decimal" defaultValue="21.50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grossMonthlyEur">{t("form.grossMonthly")}</Label>
              <Input id="grossMonthlyEur" name="grossMonthlyEur" inputMode="decimal" defaultValue="0" />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full">
                {t("form.create")}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employerOverheadPct">{t("form.employerOverheadPct")}</Label>
              <Input id="employerOverheadPct" name="employerOverheadPct" inputMode="decimal" defaultValue="30" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="productivityPct">{t("form.productivityPct")}</Label>
              <Input id="productivityPct" name="productivityPct" inputMode="decimal" defaultValue="85" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="absencePct">{t("form.absencePct")}</Label>
              <Input id="absencePct" name="absencePct" inputMode="decimal" defaultValue="6" />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.roles")}</CardTitle>
          <CardDescription>{t("form.effectiveHourlyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.role")}</TableHead>
                <TableHead>{t("workzone.status")}</TableHead>
                <TableHead className="text-right">{t("form.effectiveHourly")}</TableHead>
                <TableHead className="text-right">{t("form.baseGross")}</TableHead>
                <TableHead className="text-right">{t("form.employerOverheadShort")}</TableHead>
                <TableHead className="text-right">{t("form.productPct")}</TableHead>
                <TableHead className="text-right">{t("form.absenceShort")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => {
                const employerOverheadPct = decimalToNumber(r.employerOverheadPct);
                const productivityPct = decimalToNumber(r.productivityPct);
                const absencePct = decimalToNumber(r.absencePct);

                const hourly =
                  r.wageType === "HOURLY" && r.grossHourlyCents
                    ? effectiveLaborHourlyCost(
                        { wageType: "HOURLY", grossHourlyCents: r.grossHourlyCents },
                        { employerOverheadPct, productivityPct, absencePct },
                      )
                    : r.grossMonthlyCents
                      ? effectiveLaborHourlyCost(
                          { wageType: "MONTHLY", grossMonthlyCents: r.grossMonthlyCents, monthlyHours: 173.33 },
                          { employerOverheadPct, productivityPct, absencePct },
                        )
                      : null;

                const effEur = hourly ? (hourly.effectiveHourlyCents / 100).toFixed(2) : "—";
                const base =
                  r.wageType === "HOURLY"
                    ? `${((r.grossHourlyCents ?? 0) / 100).toFixed(2)} €/h`
                    : `${((r.grossMonthlyCents ?? 0) / 100).toFixed(0)} €/Monat`;

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.isActive ? t("form.active") : t("form.inactive")}</TableCell>
                    <TableCell className="text-right tabular-nums">{effEur}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{base}</TableCell>
                    <TableCell className="text-right">{Math.round(employerOverheadPct * 100)}</TableCell>
                    <TableCell className="text-right">{Math.round(productivityPct * 100)}</TableCell>
                    <TableCell className="text-right">{Math.round(absencePct * 100)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/app/labor/${r.id}`}>{t("common.edit")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


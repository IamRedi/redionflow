import { requireAdminTenant } from "@/lib/auth/authorization";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/prisma-types";
import { t } from "@/lib/i18n";

export default async function LaborRoleEditPage({ params }: { params: Promise<{ laborRoleId: string }> }) {
  const companyProfileId = await requireAdminTenant();
  const { laborRoleId } = await params;
  const role = await prisma.laborRole.findFirst({ where: { id: laborRoleId, companyProfileId } });
  if (!role) notFound();

  async function save(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const isActive = formData.get("isActive") === "on";

    const wageType = String(formData.get("wageType") ?? "HOURLY") as "HOURLY" | "MONTHLY";
    const grossHourlyCents = Math.round(Number(formData.get("grossHourlyEur") ?? 0) * 100);
    const grossMonthlyCents = Math.round(Number(formData.get("grossMonthlyEur") ?? 0) * 100);

    const employerOverheadPct = Number(formData.get("employerOverheadPct") ?? 0) / 100;
    const productivityPct = Number(formData.get("productivityPct") ?? 0) / 100;
    const absencePct = Number(formData.get("absencePct") ?? 0) / 100;

    const existing = await prisma.laborRole.findFirst({ where: { id, companyProfileId: actionCompanyId } });
    if (!existing) notFound();

    await prisma.laborRole.update({
      where: { id, companyProfileId: actionCompanyId },
      data: {
        name: name || existing.name,
        isActive,
        wageType,
        grossHourlyCents: wageType === "HOURLY" ? grossHourlyCents : null,
        grossMonthlyCents: wageType === "MONTHLY" ? grossMonthlyCents : null,
        employerOverheadPct,
        productivityPct,
        absencePct,
      },
    });

    redirect("/app/labor");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("form.editLaborRole")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{role.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.details")}</CardTitle>
          <CardDescription>{t("form.valuesEurPercent")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={save} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={role.id} />

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="name">{t("form.roleName")}</Label>
              <Input id="name" name="name" defaultValue={role.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wageType">{t("form.wageType")}</Label>
              <select
                id="wageType"
                name="wageType"
                defaultValue={role.wageType}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="HOURLY">{t("form.hourlyWage")}</option>
                <option value="MONTHLY">{t("form.monthlyWage")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grossHourlyEur">{t("form.grossHourly")}</Label>
              <Input
                id="grossHourlyEur"
                name="grossHourlyEur"
                inputMode="decimal"
                defaultValue={((role.grossHourlyCents ?? 0) / 100).toFixed(2)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grossMonthlyEur">{t("form.grossMonthly")}</Label>
              <Input
                id="grossMonthlyEur"
                name="grossMonthlyEur"
                inputMode="decimal"
                defaultValue={((role.grossMonthlyCents ?? 0) / 100).toFixed(0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employerOverheadPct">{t("form.employerOverheadPct")}</Label>
              <Input
                id="employerOverheadPct"
                name="employerOverheadPct"
                inputMode="decimal"
                defaultValue={(decimalToNumber(role.employerOverheadPct) * 100).toFixed(0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productivityPct">{t("form.productivityPct")}</Label>
              <Input
                id="productivityPct"
                name="productivityPct"
                inputMode="decimal"
                defaultValue={(decimalToNumber(role.productivityPct) * 100).toFixed(0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="absencePct">{t("form.absencePct")}</Label>
              <Input
                id="absencePct"
                name="absencePct"
                inputMode="decimal"
                defaultValue={(decimalToNumber(role.absencePct) * 100).toFixed(0)}
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={role.isActive} />
              <Label htmlFor="isActive">{t("form.active")}</Label>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/app/labor">{t("common.cancel")}</Link>
              </Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


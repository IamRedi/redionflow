import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { MACHINE_CATEGORY_OPTIONS, type MachineCategoryCode } from "@/lib/machines/display";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { dateKey } from "@/lib/workzone/reporting";

/* eslint-disable @next/next/no-img-element */

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanMoneyCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return 0;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function cleanOptionalMoneyCents(value: FormDataEntryValue | null) {
  const cents = cleanMoneyCents(value);
  return cents > 0 ? cents : null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(`${text}T00:00:00`) : null;
}

function dateValue(date: Date | null) {
  return date ? dateKey(date) : "";
}

function machineCategoryLabel(category: MachineCategoryCode, t: (path: string) => string) {
  return t(`form.machineCategory.${category}`);
}

function machineNameFromForm(formData: FormData) {
  return cleanText(formData.get("nickname")) ?? cleanText(formData.get("model")) ?? cleanText(formData.get("targe")) ?? "Machine";
}

async function saveMachine(formData: FormData) {
  "use server";
    const actionCompanyId = await requireAdminTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const owned = await prisma.machine.findFirst({ where: { id, companyProfileId: actionCompanyId }, select: { id: true } });
  if (!owned) notFound();
  const name = machineNameFromForm(formData);

  await prisma.machine.update({
    where: { id, companyProfileId: actionCompanyId },
    data: {
      name,
      nickname: cleanText(formData.get("nickname")) ?? name,
      model: cleanText(formData.get("model")),
      targe: cleanText(formData.get("targe")),
      vitiProdhimit: cleanInt(formData.get("vitiProdhimit")),
      vitiBlerjes: cleanInt(formData.get("vitiBlerjes")),
      tuvDate: cleanDate(formData.get("tuvDate")),
      huStatus: cleanText(formData.get("huStatus")),
      spDate: cleanDate(formData.get("spDate")),
      spStatus: cleanText(formData.get("spStatus")),
      uvvDate: cleanDate(formData.get("uvvDate")),
      uvvStatus: cleanText(formData.get("uvvStatus")),
      funksioni: cleanText(formData.get("funksioni")),
      patentaEnevojshme: cleanText(formData.get("patentaEnevojshme")),
      category: String(formData.get("category") ?? "OTHER") as MachineCategoryCode,
      hourlyRateCents: cleanMoneyCents(formData.get("hourlyEur")),
      dayRateCents: cleanOptionalMoneyCents(formData.get("dayEur")),
      imageUrl: cleanText(formData.get("imageUrl")),
      notes: cleanText(formData.get("notes")),
      isActive: formData.get("isActive") === "on",
      gpsEnabled: formData.get("gpsEnabled") === "on",
      gpsDeviceId: cleanText(formData.get("gpsDeviceId")),
    },
  });

  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/machines/${id}`);
  revalidatePath("/app/machines");
  notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
  redirect("/app/admin");
}

export default async function FleetMachineDetailPage({ params }: { params: Promise<{ machineId: string }> }) {
  const companyProfileId = await requireAdminTenant();
  const { machineId } = await params;
  const [machine, currentLang] = await Promise.all([prisma.machine.findFirst({ where: { id: machineId, companyProfileId } }), resolveRequestLanguage()]);
  if (!machine) notFound();
  const t = getTranslator(currentLang);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/app/admin">
              <ArrowLeft className="size-4" />
              {t("common.back")}
            </Link>
          </Button>
          <h1 className="mt-2 text-xl font-semibold">{machine.nickname ?? machine.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{machine.targe ?? t("workzone.noLicensePlate")} · {machine.funksioni ?? t("workzone.fleet")}</p>
        </div>
        {machine.imageUrl ? (
          <img
            src={machine.imageUrl}
            alt={machine.nickname ?? machine.name}
            className="h-20 w-28 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-20 w-28 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
            {t("common.photo")}
          </div>
        )}
      </div>

      <form action={saveMachine} className="space-y-4">
        <input type="hidden" name="id" value={machine.id} />

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">{t("admin.masterData")}</CardTitle>
            <CardDescription>{t("admin.compactListHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nickname">{t("admin.internalName")}</Label>
              <Input id="nickname" name="nickname" defaultValue={machine.nickname ?? machine.name} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="model">{t("admin.modelDescription")}</Label>
              <Input id="model" name="model" defaultValue={machine.model ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targe">{t("workzone.licensePlate")}</Label>
              <Input id="targe" name="targe" defaultValue={machine.targe ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="funksioni">{t("workzone.function")}</Label>
              <Input id="funksioni" name="funksioni" defaultValue={machine.funksioni ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t("admin.calculationCategory")}</Label>
              <select id="category" name="category" defaultValue={machine.category} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {MACHINE_CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>
                    {machineCategoryLabel(category.value, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyEur">{t("admin.calculationHourlyRate")}</Label>
              <Input id="hourlyEur" name="hourlyEur" inputMode="decimal" defaultValue={(machine.hourlyRateCents / 100).toFixed(2)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dayEur">{t("admin.calculationDayRate")}</Label>
              <Input
                id="dayEur"
                name="dayEur"
                inputMode="decimal"
                defaultValue={machine.dayRateCents != null ? (machine.dayRateCents / 100).toFixed(2) : ""}
                placeholder={t("form.optional")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patentaEnevojshme">{t("workzone.requiredLicense")}</Label>
              <Input id="patentaEnevojshme" name="patentaEnevojshme" defaultValue={machine.patentaEnevojshme ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vitiProdhimit">{t("workzone.productionYear")}</Label>
              <Input id="vitiProdhimit" name="vitiProdhimit" inputMode="numeric" defaultValue={machine.vitiProdhimit ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vitiBlerjes">{t("workzone.purchaseYear")}</Label>
              <Input id="vitiBlerjes" name="vitiBlerjes" inputMode="numeric" defaultValue={machine.vitiBlerjes ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imageUrl">{t("admin.smallPhotoUrl")}</Label>
              <Input id="imageUrl" name="imageUrl" defaultValue={machine.imageUrl ?? ""} placeholder={t("admin.smallPhotoPlaceholder")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">{t("admin.inspections")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tuvDate">{t("admin.hu")}</Label>
              <Input id="tuvDate" name="tuvDate" type="date" defaultValue={dateValue(machine.tuvDate)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="huStatus">{t("admin.huStatus")}</Label>
              <Input id="huStatus" name="huStatus" defaultValue={machine.huStatus ?? ""} />
            </div>
            <div />

            <div className="space-y-1.5">
              <Label htmlFor="spDate">{t("admin.sp")}</Label>
              <Input id="spDate" name="spDate" type="date" defaultValue={dateValue(machine.spDate)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spStatus">{t("admin.spStatus")}</Label>
              <Input id="spStatus" name="spStatus" defaultValue={machine.spStatus ?? ""} />
            </div>
            <div />

            <div className="space-y-1.5">
              <Label htmlFor="uvvDate">{t("admin.uvv")}</Label>
              <Input id="uvvDate" name="uvvDate" type="date" defaultValue={dateValue(machine.uvvDate)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uvvStatus">{t("admin.uvvStatus")}</Label>
              <Input id="uvvStatus" name="uvvStatus" defaultValue={machine.uvvStatus ?? ""} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={machine.isActive} />
              <Label htmlFor="isActive">{t("common.active")}</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">{t("admin.fleetGpsHeading")}</CardTitle>
            <CardDescription>{t("admin.fleetGpsMachineDetailDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <label className="flex items-center gap-2">
              <input id="gpsEnabled" name="gpsEnabled" type="checkbox" defaultChecked={machine.gpsEnabled} />
              <span className="text-sm">{t("admin.gpsActive")}</span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="gpsDeviceId">{t("admin.gpsDeviceId")}</Label>
              <Input id="gpsDeviceId" name="gpsDeviceId" defaultValue={machine.gpsDeviceId ?? ""} placeholder={t("admin.gpsDevicePlaceholder")} />
            </div>
            {machine.lastGpsAt ? (
              <div className="text-xs text-muted-foreground md:col-span-2">
                {t("admin.fleetGpsLastSignal")}: {machine.lastGpsAt.toLocaleString(currentLang === "de" ? "de-DE" : currentLang)} (
                {machine.lastGpsLat?.toString()}, {machine.lastGpsLng?.toString()})
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">{t("form.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" name="notes" rows={7} defaultValue={machine.notes ?? ""} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/app/admin">{t("common.cancel")}</Link>
          </Button>
          <Button type="submit">
            <Save className="size-4" />
            {t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

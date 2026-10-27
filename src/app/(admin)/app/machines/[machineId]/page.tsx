import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/i18n";
import { getCompanyMode } from "@/lib/db/company";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { machineCategoryOptions, machineOptionLabel, type MachineCategoryCode } from "@/lib/machines/display";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
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

function machineCategoryLabel(category: MachineCategoryCode, t: (path: string) => string) {
  return t(`form.machineCategory.${category}`);
}

export default async function MachineEditPage({ params }: { params: Promise<{ machineId: string }> }) {
  const companyProfileId = await requireAdminTenant();
  const { machineId } = await params;
  const [machine, currentLang, mode] = await Promise.all([prisma.machine.findFirst({ where: { id: machineId, companyProfileId } }), resolveRequestLanguage(), getCompanyMode()]);
  if (!machine) notFound();
  const t = getTranslator(currentLang, mode);

  async function save(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const id = String(formData.get("id") ?? "");
    const category = String(formData.get("category") ?? "OTHER") as MachineCategoryCode;
    const notes = cleanText(formData.get("notes"));
    const isActive = formData.get("isActive") === "on";
    const gpsEnabled = formData.get("gpsEnabled") === "on";
    const gpsDeviceId = cleanText(formData.get("gpsDeviceId"));

    const existing = await prisma.machine.findFirst({ where: { id, companyProfileId: actionCompanyId } });
    if (!existing) notFound();
    const name =
      cleanText(formData.get("nickname")) ??
      cleanText(formData.get("name")) ??
      cleanText(formData.get("model")) ??
      cleanText(formData.get("targe")) ??
      existing.name;

    await prisma.machine.update({
      where: { id, companyProfileId: actionCompanyId },
      data: {
        name,
        nickname: cleanText(formData.get("nickname")) ?? name,
        model: cleanText(formData.get("model")),
        targe: cleanText(formData.get("targe")),
        funksioni: cleanText(formData.get("funksioni")),
        category,
        hourlyRateCents: cleanMoneyCents(formData.get("hourlyEur")),
        dayRateCents: cleanOptionalMoneyCents(formData.get("dayEur")),
        notes,
        isActive,
        gpsEnabled,
        gpsDeviceId,
      },
    });
    revalidatePath("/app/machines");
    revalidatePath("/app/admin");
    notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
    redirect("/app/machines");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("form.editMachine")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{machineOptionLabel(machine)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.details")}</CardTitle>
          <CardDescription>{t("form.machineRatesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={save} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={machine.id} />

            <div className="space-y-1.5">
              <Label htmlFor="nickname">{t("admin.internalName")}</Label>
              <Input id="nickname" name="nickname" defaultValue={machine.nickname ?? machine.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targe">{t("admin.licensePlate")}</Label>
              <Input id="targe" name="targe" defaultValue={machine.targe ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model">{t("admin.model")}</Label>
              <Input id="model" name="model" defaultValue={machine.model ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="funksioni">{t("admin.machineUseArea")}</Label>
              <Input id="funksioni" name="funksioni" defaultValue={machine.funksioni ?? ""} placeholder={t("admin.machineUseAreaPlaceholder")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">{t("form.category")}</Label>
              <select
                id="category"
                name="category"
                defaultValue={machine.category}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {machineCategoryOptions(mode, machine.category).map((c) => (
                  <option key={c.value} value={c.value}>
                    {machineCategoryLabel(c.value, t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hourlyEur">{t("form.hourlyRate")}</Label>
              <Input
                id="hourlyEur"
                name="hourlyEur"
                inputMode="decimal"
                defaultValue={(machine.hourlyRateCents / 100).toFixed(2)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dayEur">{t("form.dayRateOptional")}</Label>
              <Input
                id="dayEur"
                name="dayEur"
                inputMode="decimal"
                defaultValue={machine.dayRateCents != null ? (machine.dayRateCents / 100).toFixed(2) : ""}
                placeholder={t("form.noDayRate")}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="notes">{t("form.notes")}</Label>
              <Textarea id="notes" name="notes" defaultValue={machine.notes ?? ""} rows={3} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={machine.isActive} />
              <Label htmlFor="isActive">{t("form.active")}</Label>
            </div>

            <div className="space-y-3 rounded-md border p-3 md:col-span-2">
              <div>
                <div className="text-sm font-medium">{t("admin.fleetGpsHeading")}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("admin.fleetGpsMachineDeviceHelp")}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
                <label className="flex items-center gap-2">
                  <input id="gpsEnabled" name="gpsEnabled" type="checkbox" defaultChecked={machine.gpsEnabled} />
                  <span className="text-sm">{t("admin.gpsActive")}</span>
                </label>
                <Input id="gpsDeviceId" name="gpsDeviceId" defaultValue={machine.gpsDeviceId ?? ""} placeholder={t("admin.gpsDevicePlaceholder")} />
              </div>
              {machine.lastGpsAt ? (
                <div className="text-xs text-muted-foreground">
                  {t("admin.fleetGpsLastSignal")}: {machine.lastGpsAt.toLocaleString(currentLang === "de" ? "de-DE" : currentLang)} (
                  {machine.lastGpsLat?.toString()}, {machine.lastGpsLng?.toString()})
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/app/machines">{t("common.cancel")}</Link>
              </Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

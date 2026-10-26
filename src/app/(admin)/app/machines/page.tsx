import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { checkLimit } from "@/lib/billing/limits";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { MACHINE_CATEGORY_OPTIONS, machineOptionLabel, type MachineCategoryCode } from "@/lib/machines/display";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { revalidatePath } from "next/cache";

const MACHINE_PRESETS: Array<{
  name: string;
  category: MachineCategoryCode;
  hourlyEur: string;
  funksioni: string;
}> = [
  { name: "Transporter 1", category: "TRUCK", hourlyEur: "58", funksioni: "Transport / Anfahrt" },
  { name: "Hubsteiger", category: "AWP", hourlyEur: "95", funksioni: "Baumpflege / Hoehenarbeit" },
  { name: "Haechsler", category: "CHIPPER", hourlyEur: "85", funksioni: "Gruenschnitt" },
  { name: "Motorsaege", category: "CHAINSAW", hourlyEur: "12", funksioni: "Baumdienst" },
  { name: "Rasenmaeher", category: "OTHER", hourlyEur: "28", funksioni: "Gartenpflege" },
  { name: "Minibagger", category: "OTHER", hourlyEur: "70", funksioni: "Erdarbeiten" },
];

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

export default async function MachinesPage() {
  const [company, currentLang] = await Promise.all([getOrCreateDefaultCompany(), resolveRequestLanguage()]);
  const t = getTranslator(currentLang);
  const machines = await prisma.machine.findMany({
    where: { companyProfileId: company.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  async function create(formData: FormData) {
    "use server";
    await requireAdminTenant();
    const companyId = String(formData.get("companyId") ?? "");
    const name =
      cleanText(formData.get("name")) ??
      cleanText(formData.get("nickname")) ??
      cleanText(formData.get("model")) ??
      cleanText(formData.get("targe")) ??
      "";
    if (!name) return;
    const category = String(formData.get("category") ?? "OTHER") as MachineCategoryCode;
    const hourlyRateCents = cleanMoneyCents(formData.get("hourlyEur"));
    const dayRateCents = cleanOptionalMoneyCents(formData.get("dayEur"));

    const data = {
      name,
      nickname: cleanText(formData.get("nickname")) ?? name,
      model: cleanText(formData.get("model")),
      targe: cleanText(formData.get("targe")),
      funksioni: cleanText(formData.get("funksioni")),
      category,
      hourlyRateCents,
      dayRateCents,
      isActive: true,
    };
    const currentCompanyId = await getCurrentCompanyId();
    if (!currentCompanyId || currentCompanyId !== companyId) return;
    const existing = await prisma.machine.findFirst({ where: { companyProfileId: companyId, name } });
    if (existing) {
      await prisma.machine.update({ where: { id: existing.id }, data });
    } else {
      const limit = await checkLimit(currentCompanyId, "machines");
      if (!limit.ok) return;
      await prisma.machine.create({ data: { companyProfileId: companyId, ...data } });
    }
    revalidatePath("/app/machines");
    notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.machines")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("form.machinesDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.newMachine")}</CardTitle>
          <CardDescription>{t("form.machinePricesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MACHINE_PRESETS.map((preset) => (
              <form key={preset.name} action={create}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="name" value={preset.name} />
                <input type="hidden" name="nickname" value={preset.name} />
                <input type="hidden" name="category" value={preset.category} />
                <input type="hidden" name="hourlyEur" value={preset.hourlyEur} />
                <input type="hidden" name="funksioni" value={preset.funksioni} />
                <Button type="submit" variant="outline" className="h-auto w-full justify-start py-3 text-left">
                  <span>
                    <span className="block font-medium">{preset.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {machineCategoryLabel(preset.category, t)} · {preset.hourlyEur} {t("form.hourlyRate")}
                    </span>
                  </span>
                </Button>
              </form>
            ))}
          </div>

          <form action={create} className="grid gap-4 md:grid-cols-8">
            <input type="hidden" name="companyId" value={company.id} />
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="nickname">{t("admin.internalName")}</Label>
              <Input id="nickname" name="nickname" placeholder={t("admin.machineNamePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targe">{t("admin.licensePlate")}</Label>
              <Input id="targe" name="targe" placeholder={t("admin.licensePlatePlaceholder")} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="model">{t("admin.model")}</Label>
              <Input id="model" name="model" placeholder={t("admin.machineModelPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t("form.category")}</Label>
              <select
                id="category"
                name="category"
                defaultValue="OTHER"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {MACHINE_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {machineCategoryLabel(c.value, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="funksioni">{t("admin.machineUseArea")}</Label>
              <Input id="funksioni" name="funksioni" placeholder={t("admin.machineUseAreaShortPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyEur">{t("form.hourlyRate")}</Label>
              <Input id="hourlyEur" name="hourlyEur" inputMode="decimal" defaultValue="65" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dayEur">{t("form.dayRateOptional")}</Label>
              <Input id="dayEur" name="dayEur" inputMode="decimal" placeholder={t("form.noDayRate")} />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                {t("form.create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.machines")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.name")}</TableHead>
                <TableHead>{t("workzone.status")}</TableHead>
                <TableHead>{t("admin.fleetGpsHeading")}</TableHead>
                <TableHead className="text-right">{t("form.hourlyRate")}</TableHead>
                <TableHead className="text-right">{t("form.dayRate")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div>{machineOptionLabel(m)}</div>
                    <div className="text-xs font-normal text-muted-foreground">{machineCategoryLabel((m.category ?? "OTHER") as MachineCategoryCode, t)}</div>
                  </TableCell>
                  <TableCell>{m.isActive ? t("form.active") : t("form.inactive")}</TableCell>
                  <TableCell>
                    {m.gpsEnabled ? (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {m.lastGpsAt ? `${t("admin.fleetGpsLive")} ${m.lastGpsAt.toLocaleTimeString(currentLang === "de" ? "de-DE" : currentLang, { hour: "2-digit", minute: "2-digit" })}` : t("admin.gpsReady")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("admin.gpsOff")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{(m.hourlyRateCents / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {m.dayRateCents != null ? (m.dayRateCents / 100).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/machines/${m.id}`}>{t("common.edit")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

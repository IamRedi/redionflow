"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { t, type Language } from "@/lib/i18n";
import { settingsFormSchema, type SettingsFormValues } from "@/lib/validation/schemas";
import { saveSettingsAction } from "./actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function SettingsForm({
  companyId,
  currentLang,
  defaultValues,
}: {
  companyId: string;
  currentLang: Language;
  defaultValues: Omit<SettingsFormValues, "companyId">;
}) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverMessageOk, setServerMessageOk] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema) as Resolver<SettingsFormValues>,
    defaultValues: {
      companyId,
      ...defaultValues,
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (data) => {
        setServerMessage(null);
        setServerMessageOk(false);
        const res = await saveSettingsAction(data, currentLang);
        if (res.ok) {
          setServerMessageOk(true);
          setServerMessage(res.message ?? t("validation.saved", currentLang));
          router.refresh();
        } else {
          setServerMessage(res.message);
          if (res.fieldErrors) {
            Object.entries(res.fieldErrors).forEach(([key, msgs]) => {
              if (msgs?.[0]) {
                form.setError(key as keyof SettingsFormValues, { message: msgs[0] });
              }
            });
          }
        }
      })}
    >
      <input type="hidden" {...form.register("companyId")} />

      {serverMessage ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            serverMessageOk
              ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {serverMessage}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settingsCompanyTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.settingsCompanyDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t("admin.settingsDisplayName", currentLang)}</Label>
            <Input id="displayName" {...form.register("displayName")} />
            <FieldError message={form.formState.errors.displayName?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legalName">{t("admin.settingsLegalName", currentLang)}</Label>
            <Input id="legalName" {...form.register("legalName")} />
            <FieldError message={form.formState.errors.legalName?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settingsGpsTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.settingsGpsDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Controller
              name="fleetGpsEnabled"
              control={form.control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="mt-1 size-4 accent-brand-green"
                />
              )}
            />
            <span>
              <span className="block text-sm font-medium">{t("admin.settingsFleetGpsEnable", currentLang)}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {t("admin.settingsFleetGpsDescription", currentLang)}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <Controller
              name="workerPhoneGpsEnabled"
              control={form.control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="mt-1 size-4 accent-brand-green"
                />
              )}
            />
            <span>
              <span className="block text-sm font-medium">{t("admin.settingsWorkerGpsEnable", currentLang)}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {t("admin.settingsWorkerGpsDescription", currentLang)}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settingsOverheadsTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.settingsOverheadsDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bgkPct">{t("admin.settingsBgk", currentLang)}</Label>
            <Input id="bgkPct" inputMode="decimal" {...form.register("bgkPct")} />
            <FieldError message={form.formState.errors.bgkPct?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agkPct">{t("admin.settingsAgk", currentLang)}</Label>
            <Input id="agkPct" inputMode="decimal" {...form.register("agkPct")} />
            <FieldError message={form.formState.errors.agkPct?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vatPct">{t("admin.settingsVat", currentLang)}</Label>
            <Input id="vatPct" inputMode="decimal" {...form.register("vatPct")} />
            <FieldError message={form.formState.errors.vatPct?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="riskPct">{t("admin.settingsRisk", currentLang)}</Label>
            <Input id="riskPct" inputMode="decimal" {...form.register("riskPct")} />
            <FieldError message={form.formState.errors.riskPct?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profitPct">{t("admin.settingsProfit", currentLang)}</Label>
            <Input id="profitPct" inputMode="decimal" {...form.register("profitPct")} />
            <FieldError message={form.formState.errors.profitPct?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bgkBase">{t("admin.settingsBgkBase", currentLang)}</Label>
            <select
              id="bgkBase"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              {...form.register("bgkBase")}
            >
              <option value="EK_TOTAL">{t("admin.settingsBgkBaseTotal", currentLang)}</option>
              <option value="LABOR_ONLY">{t("admin.settingsBgkBaseLabor", currentLang)}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="riskProfitMode">{t("admin.settingsRiskProfitMode", currentLang)}</Label>
            <select
              id="riskProfitMode"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              {...form.register("riskProfitMode")}
            >
              <option value="SEPARATE">{t("admin.settingsRiskProfitSeparate", currentLang)}</option>
              <option value="COMBINED">{t("admin.settingsRiskProfitCombined", currentLang)}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Controller
              name="applyVatByDefault"
              control={form.control}
              render={({ field }) => (
                <input
                  id="applyVatByDefault"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
            <Label htmlFor="applyVatByDefault">{t("admin.settingsApplyVatByDefault", currentLang)}</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("common.saving", currentLang) : t("common.save", currentLang)}
        </Button>
      </div>
    </form>
  );
}


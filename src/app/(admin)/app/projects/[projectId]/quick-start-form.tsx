"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import {
  machineOptionLabel,
  machineOptionsForField,
  type MachineListOption,
} from "@/lib/machines/display";
import { quickBaumfaellungSchema, type QuickBaumfaellungValues } from "@/lib/validation/schemas";
import { createQuickBaumfaellungAction } from "./quick-start-actions";

type Option = { id: string; name: string };

export function QuickStartForm({
  projectId,
  laborRoles,
  machines,
}: {
  projectId: string;
  laborRoles: Option[];
  machines: MachineListOption[];
}) {
  const router = useRouter();
  const { currentLang } = useLanguage();
  const [msg, setMsg] = useState<string | null>(null);

  const defaultHelper = laborRoles.find((r) => /helfer/i.test(r.name))?.id ?? laborRoles[0]?.id ?? "";
  const defaultClimber =
    laborRoles.find((r) => /(kletter|fach|baum)/i.test(r.name))?.id ?? laborRoles[0]?.id ?? "";
  const truckOptions = machineOptionsForField(machines, "TRUCK", /transporter|lkw|truck|fahrzeug|anhaenger|anhänger/);
  const chipperOptions = machineOptionsForField(machines, "CHIPPER", /h[aä]cksler|chipper|shredder/);
  const defaultTruck = truckOptions[0]?.id ?? machines[0]?.id ?? "";
  const defaultChipper =
    chipperOptions[0]?.id ?? machines[0]?.id ?? "";

  const form = useForm<QuickBaumfaellungValues>({
    resolver: zodResolver(quickBaumfaellungSchema) as Resolver<QuickBaumfaellungValues>,
    defaultValues: {
      projectId,
      climberRoleId: defaultClimber,
      helperRoleId: defaultHelper,
      truckMachineId: defaultTruck,
      chipperMachineId: defaultChipper,
    },
  });

  if (laborRoles.length < 2 || machines.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("form.quickStartRequirements", currentLang)}
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (data) => {
        setMsg(null);
        const res = await createQuickBaumfaellungAction({ ...data, lang: currentLang });
        setMsg(res.message ?? null);
        if (res.ok) router.refresh();
      })}
    >
      <input type="hidden" {...form.register("projectId")} />

      <div className="space-y-1.5">
        <Label htmlFor="climberRoleId">{t("form.skilledWorker", currentLang)}</Label>
        <select
          id="climberRoleId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          {...form.register("climberRoleId")}
        >
          {laborRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="helperRoleId">{t("form.helper", currentLang)}</Label>
        <select
          id="helperRoleId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          {...form.register("helperRoleId")}
        >
          {laborRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="truckMachineId">{t("form.truck", currentLang)}</Label>
        <select
          id="truckMachineId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          {...form.register("truckMachineId")}
        >
          {truckOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {machineOptionLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="chipperMachineId">{t("form.chipper", currentLang)}</Label>
        <select
          id="chipperMachineId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          {...form.register("chipperMachineId")}
        >
          {chipperOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {machineOptionLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("form.quickStartTreeRemovalSubmit", currentLang)}
        </Button>
        <span className="text-sm text-muted-foreground">{msg}</span>
      </div>
    </form>
  );
}


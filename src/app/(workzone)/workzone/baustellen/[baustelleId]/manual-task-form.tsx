"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { workzoneManualTaskSchema, type WorkzoneManualTaskValues } from "@/lib/validation/schemas";
import { addManualTaskAction } from "../../actions";

type CurrentWorker = { id: string; firstName: string; lastName: string; isTemporary: boolean; level: string; isAdmin?: boolean } | null;

export function ManualTaskForm({ baustelleId, currentWorker }: { baustelleId: string; currentWorker: CurrentWorker }) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const form = useForm<WorkzoneManualTaskValues>({
    resolver: zodResolver(workzoneManualTaskSchema) as Resolver<WorkzoneManualTaskValues>,
    defaultValues: { baustelleId, workerId: currentWorker?.id ?? "", description: "" },
  });

  if (!currentWorker) {
    return <p className="text-sm text-muted-foreground">{t("workzone.manualTaskPermission", currentLang)}</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit(async (data) => {
        setMsg(null);
        const res = await addManualTaskAction({ ...data, workerId: currentWorker.id });
        setMsg(res.message ?? null);
        if (res.ok) {
          form.setValue("description", "");
          router.refresh();
        } else if (res.fieldErrors?.description?.[0]) {
          form.setError("description", { message: res.fieldErrors.description[0] });
        }
      })}
    >
      <input type="hidden" {...form.register("baustelleId")} />
      <input type="hidden" {...form.register("workerId")} value={currentWorker.id} />

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t("workzone.manualTaskSavedBy", currentLang)} {currentWorker.firstName} {currentWorker.lastName}
        {currentWorker.isAdmin ? ` ${t("workzone.adminBadge", currentLang)}` : ""}.
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("report.task", currentLang)}</Label>
        <Input id="description" placeholder={t("workzone.manualTaskPlaceholder", currentLang)} {...form.register("description")} />
        {form.formState.errors.description?.message ? (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "..." : t("common.add", currentLang)}
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </form>
  );
}

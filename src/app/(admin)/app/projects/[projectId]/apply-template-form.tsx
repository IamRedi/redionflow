"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { applyTemplateSchema, type ApplyTemplateValues } from "@/lib/validation/schemas";
import { applyTemplateToProjectAction } from "./template-actions";

export function ApplyTemplateForm({
  projectId,
  templates,
}: {
  projectId: string;
  templates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const form = useForm<ApplyTemplateValues>({
    resolver: zodResolver(applyTemplateSchema) as Resolver<ApplyTemplateValues>,
    defaultValues: {
      projectId,
      templateId: templates[0]?.id ?? "",
    },
  });

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("form.noTemplatesCreateFirst")}</p>;
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={form.handleSubmit(async (data) => {
        setMsg(null);
        const res = await applyTemplateToProjectAction(data);
        setMsg(res.ok ? (res.message ?? t("common.saved")) : res.message);
        if (res.ok) router.refresh();
      })}
    >
      <input type="hidden" {...form.register("projectId")} />
      <div className="min-w-[220px] space-y-1.5">
        <Label htmlFor="templateId">{t("form.applyTemplateToProject")}</Label>
        <select
          id="templateId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          {...form.register("templateId")}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={form.formState.isSubmitting}>
        {t("form.applyTemplatePositions")}
      </Button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </form>
  );
}


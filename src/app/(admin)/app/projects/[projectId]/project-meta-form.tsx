"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { updateProjectMetaSchema, type UpdateProjectMetaValues } from "@/lib/validation/schemas";
import { updateProjectAction } from "../actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function ProjectMetaForm({ defaultValues }: { defaultValues: UpdateProjectMetaValues }) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const form = useForm<UpdateProjectMetaValues>({
    resolver: zodResolver(updateProjectMetaSchema) as Resolver<UpdateProjectMetaValues>,
    defaultValues: {
      ...defaultValues,
      customerStreet: defaultValues.customerStreet ?? "",
      customerZip: defaultValues.customerZip ?? "",
      customerCity: defaultValues.customerCity ?? "",
      internalNotes: defaultValues.internalNotes ?? "",
    },
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (data) => {
        setServerMessage(null);
        const res = await updateProjectAction(data);
        if (res.ok) {
          setServerMessage(res.message ?? t("validation.saved"));
          router.refresh();
        } else {
          setServerMessage(res.message);
          if (res.fieldErrors) {
            Object.entries(res.fieldErrors).forEach(([key, msgs]) => {
              if (msgs?.[0]) {
                form.setError(key as keyof UpdateProjectMetaValues, { message: msgs[0] });
              }
            });
          }
        }
      })}
    >
      <input type="hidden" {...form.register("projectId")} />
      {serverMessage ? (
        <p className="md:col-span-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          {serverMessage}
        </p>
      ) : null}

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="title">{t("form.title")}</Label>
        <Input id="title" {...form.register("title")} />
        <FieldError message={form.formState.errors.title?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customerName">{t("form.customer")}</Label>
        <Input id="customerName" {...form.register("customerName")} />
        <FieldError message={form.formState.errors.customerName?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">{t("workzone.status")}</Label>
        <select id="status" className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...form.register("status")}>
          <option value="DRAFT">{t("form.statusDraft")}</option>
          <option value="IN_REVIEW">{t("form.statusReview")}</option>
          <option value="SENT">{t("form.statusSent")}</option>
          <option value="ACCEPTED">{t("form.statusAccepted")}</option>
          <option value="LOST">{t("form.statusLost")}</option>
          <option value="ARCHIVED">{t("form.statusArchived")}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customerStreet">{t("form.street")}</Label>
        <Input id="customerStreet" {...form.register("customerStreet")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customerZip">{t("form.zip")}</Label>
        <Input id="customerZip" {...form.register("customerZip")} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="customerCity">{t("form.city")}</Label>
        <Input id="customerCity" {...form.register("customerCity")} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="internalNotes">{t("form.internalNotes")}</Label>
        <Textarea id="internalNotes" rows={3} {...form.register("internalNotes")} />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("form.savePending") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}


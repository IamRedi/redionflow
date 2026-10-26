"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { createProjectSchema, type CreateProjectValues } from "@/lib/validation/schemas";
import { createProjectAction } from "./actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function CreateProjectForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema) as Resolver<CreateProjectValues>,
    defaultValues: {
      companyId,
      title: "",
      customerName: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("form.newProject")}</CardTitle>
        <CardDescription>{t("form.projectStartDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-4"
          onSubmit={form.handleSubmit(async (data) => {
            setServerMessage(null);
            const res = await createProjectAction(data);
            if (res.ok) {
              setServerMessage(res.message ?? t("common.saved"));
              form.reset({ companyId, title: "", customerName: "" });
              router.refresh();
            } else {
              setServerMessage(res.message);
              if (res.fieldErrors) {
                Object.entries(res.fieldErrors).forEach(([key, msgs]) => {
                  if (msgs?.[0]) {
                    form.setError(key as keyof CreateProjectValues, { message: msgs[0] });
                  }
                });
              }
            }
          })}
        >
          <input type="hidden" {...form.register("companyId")} />
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="title">{t("form.title")}</Label>
            <Input id="title" {...form.register("title")} placeholder={t("form.titleExample")} />
            <FieldError message={form.formState.errors.title?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerName">{t("form.customer")}</Label>
            <Input id="customerName" {...form.register("customerName")} placeholder={t("form.customerPlaceholder")} />
            <FieldError message={form.formState.errors.customerName?.message} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "..." : t("form.create")}
            </Button>
          </div>
          {serverMessage ? <p className="md:col-span-4 text-sm text-muted-foreground">{serverMessage}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}


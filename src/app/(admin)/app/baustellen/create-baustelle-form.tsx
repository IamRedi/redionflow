"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/ui/cn";
import { baustelleTypeOptionsForMode, defaultBaustelleTypeForMode } from "@/lib/baustellen/type-options";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { createBaustelleSchema, type CreateBaustelleValues } from "@/lib/validation/schemas";
import { createBaustelleWithDocumentsAction } from "./actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function CreateBaustelleForm({
  companyId,
  currentLang,
  companyMode,
}: {
  companyId: string;
  currentLang: Language;
  companyMode: CompanyMode;
}) {
  const router = useRouter();
  const tx = (path: string) => t(path, currentLang, companyMode);
  const typeOptions = baustelleTypeOptionsForMode(companyMode);
  const docsRef = useRef<HTMLInputElement>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [docNames, setDocNames] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const form = useForm<CreateBaustelleValues>({
    resolver: zodResolver(createBaustelleSchema) as Resolver<CreateBaustelleValues>,
    defaultValues: {
      companyId,
      name: "",
      type: defaultBaustelleTypeForMode(companyMode),
      status: "active",
      address: "",
      description: "",
      documentsText: "",
      createFirstTreeItem: false,
      firstTreeId: "1",
      firstTreeSpecies: "",
      firstTreeDiameter: 0,
      firstTreeNote: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const createFirstTreeItem = form.watch("createFirstTreeItem");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("admin.baustellenCreateButton")}</CardTitle>
        <CardDescription>{tx("admin.createBaustelleDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit(async (data) => {
            setServerMessage(null);
            const payload = new FormData();
            payload.set("companyId", data.companyId);
            payload.set("name", data.name);
            payload.set("type", data.type);
            payload.set("status", data.status);
            payload.set("address", data.address ?? "");
            payload.set("description", data.description ?? "");
            if (data.createFirstTreeItem) {
              payload.set("createFirstTreeItem", "on");
              payload.set("firstTreeId", data.firstTreeId ?? "");
              payload.set("firstTreeSpecies", data.firstTreeSpecies ?? "");
              payload.set("firstTreeDiameter", String(data.firstTreeDiameter ?? 0));
              payload.set("firstTreeNote", data.firstTreeNote ?? "");
            }
            selectedDocs.forEach((file) => payload.append("documents", file));
            const res = await createBaustelleWithDocumentsAction(payload);
            if (res.ok) {
              setServerMessage(res.message ?? "OK");
              form.reset({
                ...data,
                name: "",
                description: "",
                documentsText: "",
                createFirstTreeItem: false,
                firstTreeId: "1",
                firstTreeSpecies: "",
                firstTreeDiameter: 0,
                firstTreeNote: "",
              });
              setDocNames([]);
              setSelectedDocs([]);
              if (docsRef.current) docsRef.current.value = "";
              router.refresh();
            } else {
              setServerMessage(res.message);
              if (res.fieldErrors) {
                Object.entries(res.fieldErrors).forEach(([key, msgs]) => {
                  if (msgs?.[0]) form.setError(key as keyof CreateBaustelleValues, { message: msgs[0] });
                });
              }
            }
          })}
        >
          <input type="hidden" {...form.register("companyId")} />

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">{tx("common.name")}</Label>
            <Input id="name" {...form.register("name")} placeholder={tx("admin.siteNamePlaceholder")} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">{tx("admin.templateType")}</Label>
            <select id="type" className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...form.register("type")}>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {tx(option.longLabelKey ?? option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">{tx("admin.colStatus")}</Label>
            <select id="status" className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...form.register("status")}>
              <option value="active">{tx("admin.statusActiveWorkable")}</option>
              <option value="inactive">{tx("admin.statusInactiveLocked")}</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">{tx("admin.siteAddress")}</Label>
            <Input id="address" {...form.register("address")} placeholder={tx("admin.siteAddressExample")} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">{tx("admin.descriptionAddress")}</Label>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </div>

          <div className="md:col-span-2 rounded-md border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" {...form.register("createFirstTreeItem")} />
              {tx("admin.addDirectTaskTree")}
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx("admin.addDirectTaskTreeDescription")}
            </p>
            {createFirstTreeItem ? (
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstTreeId">{tx("common.id")}</Label>
                  <Input id="firstTreeId" {...form.register("firstTreeId")} placeholder={tx("admin.firstTreeIdPlaceholder")} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="firstTreeSpecies">{tx("admin.speciesWork")}</Label>
                  <Input id="firstTreeSpecies" {...form.register("firstTreeSpecies")} placeholder={tx("admin.speciesWorkPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="firstTreeDiameter">{tx("admin.diameter")}</Label>
                  <Input id="firstTreeDiameter" type="number" min="0" {...form.register("firstTreeDiameter")} />
                </div>
                <div className="space-y-1.5 md:col-span-4">
                  <Label htmlFor="firstTreeNote">{tx("common.note")}</Label>
                  <Input id="firstTreeNote" {...form.register("firstTreeNote")} placeholder={tx("admin.firstTreeNotePlaceholder")} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>{tx("admin.siteAttachments")}</Label>
            <input
              ref={docsRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const next = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                setSelectedDocs(next);
                setDocNames(next.map((file) => file.name));
              }}
            />
            <button
              type="button"
              onClick={() => docsRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                const next = Array.from(event.dataTransfer.files ?? []);
                setSelectedDocs(next);
                setDocNames(next.map((file) => file.name));
                if (docsRef.current) docsRef.current.value = "";
              }}
              className={cn(
                "w-full rounded-md border border-dashed px-3 py-4 text-left transition hover:bg-muted/30",
                isDragOver ? "border-brand-green bg-brand-green/10" : "border-border",
              )}
            >
              <div className="flex items-center gap-3">
                <UploadCloud className="h-5 w-5 text-brand-green" />
                <div>
                  <div className="text-sm font-medium">{tx("admin.addDocument")}</div>
                  <div className="text-xs text-muted-foreground">{tx("admin.documentDropHint")}</div>
                </div>
              </div>
            </button>
            {docNames.length > 0 ? (
              <div className="mt-2 space-y-1 rounded-md border p-2 text-xs">
                {docNames.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-brand-green" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{tx("admin.noDocumentsSelected")}</p>
            )}
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            {serverMessage ? <p className="text-sm text-muted-foreground">{serverMessage}</p> : <span />}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "…" : tx("common.create")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


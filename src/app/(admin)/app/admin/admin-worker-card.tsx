"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CalendarRange, Eye, Pencil, Trash2 } from "lucide-react";

import { deleteWorkerAction, updateWorkerAction } from "@/app/(admin)/app/admin/worker-admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSISTANT_LANGUAGE_OPTIONS } from "@/lib/assistant/language";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { cn } from "@/lib/ui/cn";
import { CREW_ROLES } from "@/lib/workzone/crew-roles";

type AdminWorkerCardProps = {
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    emailAccount: string | null;
    position: string | null;
    licenses: string | null;
    loginCode: string | null;
    birthDate: string;
    startedAtCompany: string;
    ageLabel: string;
    availability: string;
    availabilityLabel: string;
    availabilityClass: string;
    isTemporary: boolean;
    status: string;
    vacationAllowanceDays: number;
    level: string;
    crewRole: string | null;
    motherTongue: string;
    preferredLanguage: string;
  };
  currentLang: Language;
  companyMode: CompanyMode;
  reportTodayKey: string;
  reportMonthKey: string;
};

export function AdminWorkerCard({ worker, currentLang, companyMode, reportTodayKey, reportMonthKey }: AdminWorkerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const tx = (path: string) => t(path, currentLang, companyMode);

  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 transition hover:border-primary/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary ring-1 ring-primary/20">
          {`${worker.firstName[0] ?? ""}${worker.lastName[0] ?? ""}`.toUpperCase()}
        </span>
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-sm font-semibold">{worker.firstName} {worker.lastName}</div>
            <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", worker.availabilityClass)}>
              {worker.availabilityLabel}
            </span>
            {worker.isTemporary ? <span className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">{tx("admin.colTemporary")}</span> : null}
            {companyMode === "bau" && worker.crewRole ? (
              <span className="rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
                {tx(`admin.crewRoles.${worker.crewRole}`)}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {/* Only filled fields; empty ones are edited via the pencil. */}
            {(
              [
                ["admin.colPosition", worker.position],
                ["admin.colPhone", worker.phone],
                ["admin.colEmail", worker.emailAccount],
                ["admin.colLicenses", worker.licenses],
                ["admin.colLoginCode", worker.loginCode],
                ["admin.colAge", worker.ageLabel === "-" ? null : worker.ageLabel],
                ["admin.colStart", worker.startedAtCompany],
              ] as const
            )
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <span key={label}>
                  {tx(label)}: {value}
                </span>
              ))}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {(
            [
              [`/app/admin/workers/${worker.id}`, tx("admin.profile"), Eye],
              [`/app/admin/workers/${worker.id}/day/${reportTodayKey}`, tx("common.today"), CalendarDays],
              [`/app/admin/workers/${worker.id}/month/${reportMonthKey}`, tx("common.month"), CalendarRange],
            ] as const
          ).map(([href, label, Icon]) => (
            <Button key={href} asChild variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-foreground" title={label}>
              <Link href={href} aria-label={label}>
                <Icon className="size-4" strokeWidth={1.8} />
              </Link>
            </Button>
          ))}
          <Button
            type="button"
            variant={isEditing ? "secondary" : "ghost"}
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            title={tx("common.edit")}
            aria-label={tx("common.edit")}
            onClick={() => setIsEditing((value) => !value)}
          >
            <Pencil className="size-4" strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-3 rounded-2xl border bg-background/50 p-3">
          <form action={updateWorkerAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-12">
            <input type="hidden" name="id" value={worker.id} />
            <input type="hidden" name="status" value={worker.status} />
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colFirstName")}
              <Input name="firstName" defaultValue={worker.firstName} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colLastName")}
              <Input name="lastName" defaultValue={worker.lastName} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colPhone")}
              <Input name="phone" defaultValue={worker.phone ?? ""} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colEmail")}
              <Input name="emailAccount" type="email" defaultValue={worker.emailAccount ?? ""} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colPosition")}
              <Input name="position" defaultValue={worker.position ?? ""} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colLicenses")}
              <Input name="licenses" defaultValue={worker.licenses ?? ""} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.colLoginCode")}
              <Input name="loginCode" defaultValue={worker.loginCode ?? ""} maxLength={6} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.vacationDays")}
              <Input name="vacationAllowanceDays" type="number" min="0" defaultValue={worker.vacationAllowanceDays} className="h-8 text-sm" />
            </label>
            {companyMode === "bau" ? (
              <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                {tx("admin.crewRole")}
                <select name="crewRole" defaultValue={worker.crewRole ?? ""} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="">{tx("admin.crewRoleNone")}</option>
                  {CREW_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {tx(`admin.crewRoles.${role}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.colLevel")}
              <select name="level" defaultValue={worker.level} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                <option value="JUNIOR">{tx("admin.levelJunior")}</option>
                <option value="WORKER">{tx("admin.levelWorker")}</option>
                <option value="SENIOR">{tx("admin.levelSenior")}</option>
                <option value="VORARBEITER">{tx("admin.levelForeman")}</option>
                <option value="MEISTER">{tx("admin.levelMaster")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.colStart")}
              <Input name="startedAtCompany" type="date" defaultValue={worker.startedAtCompany} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground lg:col-span-2">
              {tx("admin.birthDate")}
              <Input name="birthDate" type="date" defaultValue={worker.birthDate} className="h-8 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.colAvailability")}
              <select name="availability" defaultValue={worker.availability} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                <option value="AVAILABLE">{tx("admin.availabilityAvailable")}</option>
                <option value="SICK">{tx("admin.availabilitySick")}</option>
                <option value="VACATION">{tx("admin.availabilityVacation")}</option>
                <option value="UNAVAILABLE">{tx("admin.availabilityUnavailable")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.colMotherTongue")}
              <select name="motherTongue" defaultValue={worker.motherTongue} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              {tx("admin.colResponseLanguage")}
              <select name="preferredLanguage" defaultValue={worker.preferredLanguage} className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 rounded-md border bg-background/60 px-2 py-1 text-xs text-muted-foreground">
              <input name="isTemporary" type="checkbox" defaultChecked={worker.isTemporary} />
              {tx("admin.colTemporary")}
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button type="submit" size="sm" className="h-8">
                {tx("common.save")}
              </Button>
            </div>
          </form>

          <form action={deleteWorkerAction} className="mt-3 flex justify-end">
            <input type="hidden" name="id" value={worker.id} />
            <Button type="submit" size="sm" variant="destructive" aria-label={tx("admin.deleteWorker")}>
              <Trash2 className="size-4" />
              {tx("common.delete")}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

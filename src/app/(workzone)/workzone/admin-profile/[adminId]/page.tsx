import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSISTANT_LANGUAGE_OPTIONS } from "@/lib/assistant/language";
import { getCurrentAdmin, isPrimaryTestAdmin, LEGACY_LUCY_ADMIN_EMAIL } from "@/lib/auth/admin-session";
import { getAdminCompanyId } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { reportLocale } from "@/lib/workzone/date-utils";
import { dateKey } from "@/lib/workzone/reporting";
import { updateManagedTestAdminFormAction } from "@/app/(admin)/app/profile/actions";
import { DeleteAdminButton } from "../delete-admin-button";

function adminInitials(name: string | null, email: string) {
  const source = (name ?? email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function WorkzoneAdminProfilePage({
  params,
}: {
  params: Promise<{ adminId: string }>;
}) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) redirect("/workzone");
  const currentLang = await resolveRequestLanguage();

  const companyProfileId = await getAdminCompanyId();
  if (!companyProfileId) notFound();
  const { adminId } = await params;
  const profile = await prisma.user.findFirst({
    where: { id: adminId, role: "ADMIN", isActive: true, companyProfileId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      preferredLanguage: true,
      motherTongue: true,
      aiPersonalityNote: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!profile) notFound();
  if (profile.email === LEGACY_LUCY_ADMIN_EMAIL) notFound();

  const isOwnProfile = currentAdmin.id === profile.id;
  const canEditThisAdmin = isPrimaryTestAdmin(currentAdmin.email) && !isPrimaryTestAdmin(profile.email);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-brand-green/25 via-muted to-background" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <div className="flex size-24 items-center justify-center rounded-full border-4 border-background bg-muted text-2xl font-semibold shadow-sm">
              {adminInitials(profile.name, profile.email)}
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-semibold">{profile.name ?? profile.email}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("common.role", currentLang)}: {profile.role}
              </p>
              {profile.id === currentAdmin.id ? (
                <p className="mt-1 text-xs font-medium text-muted-foreground">{t("admin.loggedInAdmin", currentLang)}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/workzone">{t("common.back", currentLang)}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/dashboard">{t("admin.openPanel", currentLang)}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/admin/day/${dateKey(new Date())}`}>{t("admin.todayAdminReport", currentLang)}</Link>
            </Button>
            {isOwnProfile ? (
              <Button asChild variant="outline">
                <Link href="/app/profile">{t("admin.openOwnAdminProfile", currentLang)}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.identityLanguage", currentLang)}</CardTitle>
            <CardDescription>{t("admin.adminProfileDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.name", currentLang)}</span>
              <span>{profile.name ?? "-"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.email", currentLang)}</span>
              <span>{profile.email}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.responseLanguage", currentLang)}</span>
                <span>{profile.preferredLanguage ?? "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.motherTongue", currentLang)}</span>
                <span>{profile.motherTongue ?? "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.assistantProfile", currentLang)}</CardTitle>
            <CardDescription>{t("admin.systemAccessDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.settings", currentLang)}</span>
              <span>{profile.aiPersonalityNote?.trim() || "-"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.createdAt", currentLang)}</span>
                <span>{profile.createdAt.toLocaleString(reportLocale(currentLang))}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("admin.updatedAt", currentLang)}</span>
                <span>{profile.updatedAt.toLocaleString(reportLocale(currentLang))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {canEditThisAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.editTestAdminTitle", currentLang)}</CardTitle>
            <CardDescription>{t("admin.editTestAdminDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateManagedTestAdminFormAction} className="grid gap-4">
              <input type="hidden" name="adminId" value={profile.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="managed-name">{t("common.name", currentLang)}</Label>
                  <Input id="managed-name" name="name" defaultValue={profile.name ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="managed-email">{t("common.email", currentLang)}</Label>
                  <Input id="managed-email" name="email" type="email" defaultValue={profile.email} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="managed-code">{t("form.loginCodePlaceholder", currentLang)}</Label>
                  <Input id="managed-code" name="code" inputMode="numeric" maxLength={6} defaultValue="" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="managed-motherTongue">{t("admin.motherTongue", currentLang)}</Label>
                  <select id="managed-motherTongue" name="motherTongue" defaultValue={profile.motherTongue ?? "DE"} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="managed-preferredLanguage">{t("admin.responseLanguage", currentLang)}</Label>
                  <select id="managed-preferredLanguage" name="preferredLanguage" defaultValue={profile.preferredLanguage ?? "DE"} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={profile.isActive} />
                {t("common.active", currentLang)}
              </label>
              <div className="flex justify-end">
                <Button type="submit" variant="outline">{t("admin.saveAdmin", currentLang)}</Button>
              </div>
            </form>
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs text-muted-foreground">{t("admin.removeAdminDescription", currentLang)}</p>
                <DeleteAdminButton adminId={profile.id} adminLabel={profile.name ?? profile.email} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

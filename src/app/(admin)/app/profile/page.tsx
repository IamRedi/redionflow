import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSISTANT_LANGUAGE_OPTIONS } from "@/lib/assistant/language";
import { getCurrentAdmin, isPrimaryTestAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { updateAdminProfileFormAction, upsertTestAdminFormAction } from "./actions";

export default async function AdminProfilePage() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  const currentLang = await resolveRequestLanguage();

  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      preferredLanguage: true,
      motherTongue: true,
      aiPersonalityNote: true,
    },
  });
  if (!user) return null;

  const canManageAdmins = isPrimaryTestAdmin(user.email);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.adminProfileHeading", currentLang)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.adminProfileSubtitle", currentLang)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.identityLanguageTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.identityLanguageDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAdminProfileFormAction} className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("common.name", currentLang)}</Label>
                <Input id="name" name="name" defaultValue={user.name ?? ""} placeholder={t("admin.adminNamePlaceholder", currentLang)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("common.email", currentLang)}</Label>
                <Input id="email" value={user.email} readOnly />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="motherTongue">{t("admin.motherTongue", currentLang)}</Label>
                <select
                  id="motherTongue"
                  name="motherTongue"
                  defaultValue={user.motherTongue ?? "DE"}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredLanguage">{t("admin.responseLanguageFallback", currentLang)}</Label>
                <select
                  id="preferredLanguage"
                  name="preferredLanguage"
                  defaultValue={user.preferredLanguage ?? "DE"}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aiPersonalityNote">{t("admin.aiPersonalityNote", currentLang)}</Label>
              <textarea
                id="aiPersonalityNote"
                name="aiPersonalityNote"
                defaultValue={user.aiPersonalityNote ?? ""}
                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder={t("admin.aiPersonalityPlaceholder", currentLang)}
              />
              <div className="text-xs text-muted-foreground">
                {t("admin.aiPersonalityHint", currentLang).replace("{name}", user.name ?? "Admin")}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" variant="outline">
                {t("common.save", currentLang)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {canManageAdmins ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.testAdminManagement", currentLang)}</CardTitle>
            <CardDescription>{t("admin.testAdminManagementDescription", currentLang)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {t("admin.primaryTestAdminNotice", currentLang)}
            </div>

            <form action={upsertTestAdminFormAction} className="grid gap-3 rounded-xl border border-dashed p-4">
              <div className="text-sm font-medium">{t("admin.createTestAdminTitle", currentLang)}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-name">{t("common.name", currentLang)}</Label>
                  <Input id="new-admin-name" name="name" placeholder={t("admin.newAdminNamePlaceholder", currentLang)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-email">{t("common.email", currentLang)}</Label>
                  <Input id="new-admin-email" name="email" type="email" placeholder={t("admin.newAdminEmailPlaceholder", currentLang)} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-code">{t("admin.sixDigitCode", currentLang)}</Label>
                  <Input id="new-admin-code" name="code" inputMode="numeric" maxLength={6} placeholder={t("admin.newAdminCodePlaceholder", currentLang)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-motherTongue">{t("admin.motherTongue", currentLang)}</Label>
                  <select id="new-admin-motherTongue" name="motherTongue" defaultValue="DE" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-admin-preferredLanguage">{t("admin.responseLanguage", currentLang)}</Label>
                  <select id="new-admin-preferredLanguage" name="preferredLanguage" defaultValue="DE" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked />
                {t("admin.active", currentLang)}
              </label>
              <div className="flex justify-end">
                <Button type="submit" variant="outline">{t("admin.createTestAdminButton", currentLang)}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

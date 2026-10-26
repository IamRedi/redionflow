import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { baustelleTypeOptionsForMode } from "@/lib/baustellen/type-options";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import type { CompanyMode } from "@/lib/mode-config";
import { formatCount } from "@/lib/workzone/date-utils";
import { CreateBaustelleForm } from "./create-baustelle-form";
import { clearBaustelleImportDataAction, deleteBaustelleAction, updateBaustelleMetaAction } from "./actions";

function typeLabel(value: string, currentLang: Language, mode: CompanyMode) {
  const option = baustelleTypeOptionsForMode(mode).find((item) => item.value === value);
  if (option) return t(option.labelKey, currentLang, mode);
  return value;
}

function statusLabel(value: string, currentLang: Language, mode: CompanyMode) {
  return value === "active" ? t("common.active", currentLang, mode) : t("admin.inactive", currentLang, mode);
}

export default async function BaustellenAdminPage() {
  const [company, mode, currentLang] = await Promise.all([
    getOrCreateDefaultCompany(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const baustellen = await withPilotDbContext(company.id, tx => tx.baustelle.findMany({
    where: { companyProfileId: company.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      address: true,
      description: true,
      documents: true,
      updatedAt: true,
      _count: { select: { treeItems: true } },
    },
    take: 200,
  }), "admin");
  const typeOptions = baustelleTypeOptionsForMode(mode);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.baustellenHeading", currentLang, mode)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.baustellenSubtitle", currentLang, mode)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/baustellen/import">{t("admin.baustellenImport", currentLang, mode)}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/workzone">{t("admin.workzoneLabel", currentLang, mode)}</Link>
          </Button>
        </div>
      </div>

      <CreateBaustelleForm companyId={company.id} currentLang={currentLang} companyMode={mode} />

      <Card>
        <CardHeader>
          <CardTitle>{t("common.overview", currentLang, mode)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name", currentLang, mode)}</TableHead>
                <TableHead>{t("common.type", currentLang, mode)}</TableHead>
                <TableHead>{t("admin.colStatus", currentLang, mode)}</TableHead>
                <TableHead>{t("common.address", currentLang, mode)}</TableHead>
                <TableHead className="w-[220px] text-right">{t("admin.colActions", currentLang, mode)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baustellen.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{b.name}</span>
                        <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t("admin.baustelleTreesCount", currentLang, mode).replace("{count}", formatCount(b._count.treeItems, currentLang))}
                        </span>
                        <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t("admin.baustelleFilesCount", currentLang, mode).replace("{count}", formatCount(b.documents.length, currentLang))}
                        </span>
                      </div>

                      <details className="rounded-lg border bg-muted/10 p-2.5">
                        <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
                          {t("common.edit", currentLang, mode)}
                        </summary>
                        <form action={updateBaustelleMetaAction} className="mt-2 grid gap-2">
                          <input type="hidden" name="baustelleId" value={b.id} />
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input name="name" defaultValue={b.name} className="h-8" />
                            <select
                              name="type"
                              defaultValue={b.type}
                              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              {typeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {t(option.labelKey, currentLang, mode)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <select
                              name="status"
                              defaultValue={b.status}
                              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="active">{t("common.active", currentLang, mode)}</option>
                              <option value="inactive">{t("admin.inactive", currentLang, mode)}</option>
                            </select>
                            <Input name="address" defaultValue={b.address ?? ""} className="h-8" placeholder={t("admin.siteAddressPlaceholder", currentLang, mode)} />
                          </div>
                          <Input
                            name="description"
                            defaultValue={b.description ?? ""}
                            className="h-8"
                            placeholder={t("admin.shortDescriptionOptional", currentLang, mode)}
                          />
                          <div className="flex justify-end">
                            <Button type="submit" size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                              {t("common.save", currentLang, mode)}
                            </Button>
                          </div>
                        </form>
                      </details>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-200">
                      {typeLabel(b.type, currentLang, mode)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        b.status === "active"
                          ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          : "border border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {statusLabel(b.status, currentLang, mode)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-muted-foreground" title={b.address ?? ""}>
                    {b.address ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                        <Link href={`/app/baustellen/export/${b.id}`}>{t("admin.exportLabel", currentLang, mode)}</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                        <Link href={`/workzone/baustellen/${b.id}`}>{t("admin.workzoneLabel", currentLang, mode)}</Link>
                      </Button>
                    </div>

                    <details className="mt-2 rounded-lg border bg-muted/10 p-2 text-left">
                      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
                        {t("admin.management", currentLang, mode)}
                      </summary>
                      <div className="mt-2 flex flex-col gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 justify-start px-2.5 text-xs">
                          <Link href={`/app/baustellen/import?targetBaustelleId=${b.id}&targetName=${encodeURIComponent(b.name)}`}>
                            {t("admin.reImport", currentLang, mode)}
                          </Link>
                        </Button>
                        <form action={clearBaustelleImportDataAction}>
                          <input type="hidden" name="baustelleId" value={b.id} />
                          <Button type="submit" size="sm" variant="outline" className="h-8 w-full justify-start px-2.5 text-xs">
                            {t("admin.deleteImportData", currentLang, mode)}
                          </Button>
                        </form>
                        <form action={deleteBaustelleAction}>
                          <input type="hidden" name="baustelleId" value={b.id} />
                          <Button type="submit" size="sm" variant="destructive" className="h-8 w-full justify-start px-2.5 text-xs">
                            {t("admin.deleteBaustelle", currentLang, mode)}
                          </Button>
                        </form>
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {baustellen.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("admin.baustellenEmptyShort", currentLang, mode)}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

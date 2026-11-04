import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  Download,
  Eraser,
  ListChecks,
  MapPin,
  MonitorSmartphone,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SteelSiteArt } from "@/components/steel/steel-art";
import { AssetPhoto } from "@/components/asset-photo";
import { assetPhotoUrl } from "@/lib/asset-photos/shared";
import { baustelleTypeOptionsForMode } from "@/lib/baustellen/type-options";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import type { CompanyMode } from "@/lib/mode-config";
import { formatCount } from "@/lib/workzone/date-utils";
import { isSteelSiteType, steelSiteShape } from "@/lib/workzone/steel-phases";
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
      coverPhotoAt: true,
      updatedAt: true,
      _count: { select: { treeItems: true } },
    },
    take: 200,
  }), "admin");
  const typeOptions = baustelleTypeOptionsForMode(mode);
  const ids = baustellen.map((b) => b.id);
  const doneRows = ids.length
    ? await withPilotDbContext(company.id, (tx) =>
        tx.treeItem.groupBy({ by: ["baustelleId"], where: { baustelleId: { in: ids }, status: "done" }, _count: { _all: true } }),
      "admin")
    : [];
  const doneBySite = new Map(doneRows.map((row) => [row.baustelleId, row._count._all]));
  const activeCount = baustellen.filter((b) => b.status === "active").length;
  const tx = (key: string) => t(key, currentLang, mode);
  const field = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{tx("admin.navBaustellenGroup")}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tx("admin.baustellenHeading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx("admin.baustellenSummary").replace("{active}", formatCount(activeCount, currentLang)).replace("{total}", formatCount(baustellen.length, currentLang))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg">
            <Link href="/app/baustellen/import">
              <Upload className="size-4" strokeWidth={1.8} /> {tx("admin.baustellenImport")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg">
            <Link href="/workzone">
              <MonitorSmartphone className="size-4" strokeWidth={1.8} /> {tx("admin.workzoneLabel")}
            </Link>
          </Button>
        </div>
      </div>

      <details className="group rounded-2xl border bg-card/60 open:bg-card open:shadow-sm">
        <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-foreground/90 transition hover:bg-foreground/[0.03] [&::-webkit-details-marker]:hidden">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <Plus className="size-4 transition-transform group-open:rotate-45" />
          </span>
          {tx("admin.baustellenCreateButton")}
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-2">
          <CreateBaustelleForm companyId={company.id} currentLang={currentLang} companyMode={mode} />
        </div>
      </details>

      {baustellen.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{tx("admin.baustellenEmptyShort")}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {baustellen.map((b) => {
            const steel = isSteelSiteType(b.type);
            const total = b._count.treeItems;
            const done = doneBySite.get(b.id) ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const active = b.status === "active";
            return (
              <li key={b.id} className="group/card flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
                <div className="relative h-24 border-b bg-gradient-to-br from-orange-50 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
                  <AssetPhoto key={`${b.id}:${b.coverPhotoAt}`} kind="site" id={b.id} src={assetPhotoUrl('site',b.id,b.coverPhotoAt)} alt={b.name} canEdit>
                  {steel ? (
                    <SteelSiteArt type={b.type} shape={steelSiteShape(b.name, b.description)} pct={pct} live={false} className="absolute inset-0 h-full w-full" />
                  ) : (
                    <div className="grid h-full place-items-center text-primary/70">
                      <Building2 className="size-10" strokeWidth={1.4} />
                    </div>
                  )}
                  </AssetPhoto>
                  <span
                    className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border bg-background/90 px-2 py-0.5 text-[11px] font-semibold backdrop-blur ${
                      active ? "border-green-500/40 text-green-700 dark:text-green-300" : "text-muted-foreground"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-400"}`} />
                    {statusLabel(b.status, currentLang, mode)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <div className="min-w-0">
                    <Link href={`/workzone/baustellen/${b.id}`} className="block truncate text-[15px] font-semibold tracking-tight hover:text-primary">
                      {b.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{b.address || "—"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5">{typeLabel(b.type, currentLang, mode)}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                      <ListChecks className="size-3.5" strokeWidth={1.8} />
                      {total > 0 ? `${done}/` : ""}
                      {tx("admin.baustelleTreesCount").replace("{count}", formatCount(total, currentLang))}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                      <Paperclip className="size-3.5" strokeWidth={1.8} /> {formatCount(b.documents.length, currentLang)}
                    </span>
                  </div>

                  {total > 0 ? (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    <Button asChild size="sm" variant="ghost" className="h-8 flex-1 gap-1.5 rounded-lg bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary">
                      <Link href={`/workzone/baustellen/${b.id}`}>
                        {tx("admin.openSite")} <ArrowUpRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="icon" variant="outline" className="size-8 rounded-lg" title={tx("admin.exportLabel")}>
                      <Link href={`/app/baustellen/export/${b.id}`} aria-label={tx("admin.exportLabel")}>
                        <Download className="size-4" strokeWidth={1.8} />
                      </Link>
                    </Button>
                  </div>

                  <details className="group/more rounded-lg border bg-muted/20 text-sm open:bg-muted/30">
                    <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <Pencil className="size-3.5" strokeWidth={1.8} /> {tx("admin.editAndManage")}
                      <ChevronDown className="ml-auto size-3.5 transition-transform group-open/more:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t p-2.5">
                      <form action={updateBaustelleMetaAction} className="grid gap-2">
                        <input type="hidden" name="baustelleId" value={b.id} />
                        <Input name="name" defaultValue={b.name} className="h-9 rounded-lg" aria-label={tx("common.name")} />
                        <div className="grid grid-cols-2 gap-2">
                          <select name="type" defaultValue={b.type} className={field} aria-label={tx("common.type")}>
                            {typeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {t(option.labelKey, currentLang, mode)}
                              </option>
                            ))}
                          </select>
                          <select name="status" defaultValue={b.status} className={field} aria-label={tx("admin.colStatus")}>
                            <option value="active">{tx("common.active")}</option>
                            <option value="inactive">{tx("admin.inactive")}</option>
                          </select>
                        </div>
                        <Input name="address" defaultValue={b.address ?? ""} className="h-9 rounded-lg" placeholder={tx("admin.siteAddressPlaceholder")} />
                        <Input name="description" defaultValue={b.description ?? ""} className="h-9 rounded-lg" placeholder={tx("admin.shortDescriptionOptional")} />
                        <Button type="submit" size="sm" className="h-8 rounded-lg">
                          {tx("common.save")}
                        </Button>
                      </form>
                      <div className="grid grid-cols-2 gap-1.5 border-t pt-2">
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg text-xs">
                          <Link href={`/app/baustellen/import?targetBaustelleId=${b.id}&targetName=${encodeURIComponent(b.name)}`}>
                            <RefreshCw className="size-3.5" /> {tx("admin.reImport")}
                          </Link>
                        </Button>
                        <form action={clearBaustelleImportDataAction}>
                          <input type="hidden" name="baustelleId" value={b.id} />
                          <Button type="submit" size="sm" variant="outline" className="h-8 w-full gap-1.5 rounded-lg text-xs">
                            <Eraser className="size-3.5" /> {tx("admin.deleteImportData")}
                          </Button>
                        </form>
                        <form action={deleteBaustelleAction} className="col-span-2">
                          <input type="hidden" name="baustelleId" value={b.id} />
                          <Button type="submit" size="sm" variant="ghost" className="h-8 w-full gap-1.5 rounded-lg text-xs text-red-600 hover:bg-red-500/10 hover:text-red-600">
                            <Trash2 className="size-3.5" /> {tx("admin.deleteBaustelle")}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { t, type Language } from "@/lib/i18n";
import { upsertSafetyCatalogItemAction } from "./safety-actions";

const safetyRows = [
  { category: "SIGN", titleKey: "admin.safetySignTitle" },
  { category: "PLATE", titleKey: "admin.safetyPlateTitle" },
  { category: "FENCE", titleKey: "admin.safetyFenceTitle" },
] as const;

function localeForLanguage(lang: Language) {
  if (lang === "en") return "en-US";
  if (lang === "it") return "it-IT";
  if (lang === "sq") return "sq-AL";
  if (lang === "ro") return "ro-RO";
  if (lang === "pl") return "pl-PL";
  return "de-DE";
}

function fallbackSafetyLabel(category: string, lang: Language) {
  if (category === "FENCE") return t("admin.safetyFenceLabel", lang);
  if (category === "PLATE") return t("admin.safetyPlateLabel", lang);
  if (category === "SIGN") return t("admin.safetySignLabel", lang);
  return category;
}

export async function SafetyOverviewSection({ currentLang }: { currentLang: Language }) {
  const company = await getOrCreateDefaultCompany();
  const [safetyCatalog, safetyMovements, movementAgg] = await Promise.all([
    prisma.companyInventoryCatalog.findMany({
      where: { companyProfileId: company.id },
      orderBy: { category: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: { companyProfileId: company.id },
      orderBy: { timestamp: "desc" },
      include: {
        worker: { select: { firstName: true, lastName: true } },
        baustelle: { select: { name: true } },
        treeItem: { select: { treeId: true } },
      },
      take: 40,
    }),
    prisma.inventoryMovement.groupBy({
      by: ["category", "type"],
      where: { companyProfileId: company.id },
      _sum: { quantity: true },
    }),
  ]);

  const deployedByCategory = new Map<string, number>();
  for (const row of movementAgg) {
    const key = String(row.category);
    const prev = deployedByCategory.get(key) ?? 0;
    const qty = Number(row._sum.quantity ?? 0);
    const delta = row.type === "DEPLOY" ? qty : -qty;
    deployedByCategory.set(key, prev + delta);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {safetyRows.map((row) => {
          const item = safetyCatalog.find((catalog) => catalog.category === row.category);
          const total = item?.totalQuantity ?? 0;
          const onSiteRaw = deployedByCategory.get(row.category) ?? 0;
          const onSite = Math.max(0, onSiteRaw);
          const available = Math.max(0, total - onSite);
          const rowTitle = t(row.titleKey, currentLang);
          const typeLabel = item?.name?.trim() || rowTitle;

          return (
            <div key={row.category} className="rounded-md border p-3">
              <div className="text-sm font-semibold">{rowTitle}</div>
              <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                <div>
                  {t("admin.totalStock", currentLang)}: <span className="font-medium text-foreground">{total}</span>
                </div>
                <div>
                  {t("admin.onSites", currentLang)}: <span className="font-medium text-foreground">{onSite}</span>
                </div>
                <div>
                  {t("admin.available", currentLang)}: <span className="font-medium text-foreground">{available}</span>
                </div>
              </div>

              <details className="mt-2 rounded-md border bg-muted/20 p-2">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">{t("admin.edit", currentLang)}</summary>
                <form action={upsertSafetyCatalogItemAction} className="mt-2 space-y-2">
                  <input type="hidden" name="companyId" value={company.id} />
                  <input type="hidden" name="category" value={row.category} />
                  <Input name="name" defaultValue={typeLabel} className="h-8" required />
                  <Input name="totalQuantity" defaultValue={String(total)} type="number" min={0} className="h-8" required />
                  <Button type="submit" size="sm" variant="outline">
                    {t("admin.saveStock", currentLang)}
                  </Button>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("admin.movementsLast40", currentLang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.inventoryWorker", currentLang)}</TableHead>
                <TableHead>{t("admin.typeColumn", currentLang)}</TableHead>
                <TableHead>{t("admin.actionColumn", currentLang)}</TableHead>
                <TableHead>{t("admin.quantityColumn", currentLang)}</TableHead>
                <TableHead>{t("admin.fleetGpsSite", currentLang)}</TableHead>
                <TableHead>{t("admin.treeColumn", currentLang)}</TableHead>
                <TableHead>{t("admin.dateColumn", currentLang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safetyMovements.map((row) => {
                const catalog = safetyCatalog.find((c) => c.category === row.category);
                const label = catalog?.name?.trim()
                  ? `${catalog.name} (${row.category})`
                  : row.category === "FENCE"
                    ? t("admin.safetyFenceLabel", currentLang)
                    : row.category === "PLATE"
                      ? t("admin.safetyPlateLabel", currentLang)
                      : row.category === "SIGN"
                        ? t("admin.safetySignLabel", currentLang)
                        : fallbackSafetyLabel(String(row.category), currentLang);

                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.actorName ?? (row.worker ? `${row.worker.firstName} ${row.worker.lastName}`.trim() : "Admin")}</TableCell>
                    <TableCell>{label}</TableCell>
                    <TableCell>{row.type === "DEPLOY" ? t("admin.movementActionOut", currentLang) : t("admin.movementActionIn", currentLang)}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.baustelle.name}</TableCell>
                    <TableCell>{row.treeItem?.treeId ?? "-"}</TableCell>
                    <TableCell>{new Date(row.timestamp).toLocaleString(localeForLanguage(currentLang))}</TableCell>
                  </TableRow>
                );
              })}
              {safetyMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    {t("admin.noMovements", currentLang)}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

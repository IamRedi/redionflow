import { AdminInventoryCategoryTable } from "@/app/(admin)/app/inventory/admin-inventory-category-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { t, type Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { AdminInventoryConsole } from "./admin-inventory-console";

function localeForLanguage(lang: Language) {
  if (lang === "en") return "en-US";
  if (lang === "it") return "it-IT";
  if (lang === "sq") return "sq-AL";
  if (lang === "ro") return "ro-RO";
  if (lang === "pl") return "pl-PL";
  return "de-DE";
}

function categoryLabel(category: string, lang: Language) {
  if (category === "CLOTHING") return t("admin.inventoryCategoryClothing", lang);
  if (category === "SITE_EQUIPMENT") return t("admin.inventoryCategorySiteEquipment", lang);
  return t("admin.inventoryCategoryWorkTool", lang);
}

export default async function AdminInventoryPage() {
  const [company, currentLang] = await Promise.all([getOrCreateDefaultCompany(), resolveRequestLanguage()]);
  const [items, activeAssignments, privateAssets, movements] = await Promise.all([
    prisma.companyInventoryItem.findMany({
      where: { companyProfileId: company.id },
      orderBy: [{ category: "asc" }, { isActive: "desc" }, { itemCode: "asc" }],
    }),
    prisma.workerAssetItem.findMany({
      where: { status: { not: "DELETED" }, companyInventoryItemId: { not: null } },
      include: { worker: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workerAssetItem.findMany({
      where: { status: { not: "DELETED" }, isPrivate: true },
      include: { worker: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.inventoryAssetMovement.findMany({
      where: { companyProfileId: company.id },
      include: {
        item: { select: { id: true, name: true, itemCode: true } },
        worker: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const assignmentByItemId = new Map<string, (typeof activeAssignments)[number]>(
    activeAssignments.map((entry) => [entry.companyInventoryItemId ?? "", entry]),
  );
  const categories = ["WORK_TOOL", "CLOTHING", "SITE_EQUIPMENT"] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.inventoryHeading", currentLang)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.inventorySubtitle", currentLang)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.inventoryIntakeTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.inventoryIntakeDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminInventoryConsole currentLang={currentLang} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {categories.map((category) => {
          const categoryItems = items
            .filter((item) => item.category === category)
            .map((item) => {
              const assignment = assignmentByItemId.get(item.id);
              return {
                id: item.id,
                itemCode: item.itemCode,
                name: item.name,
                sizeLabel: item.sizeLabel,
                barcode: item.barcode,
                note: item.note,
                isActive: item.isActive,
                assignedWorkerName: assignment ? `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim() : null,
              };
            });

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle>{categoryLabel(category, currentLang)}</CardTitle>
                <CardDescription>{categoryItems.length} {t("admin.inventorySingleItems", currentLang)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminInventoryCategoryTable category={category} currentLang={currentLang} items={categoryItems} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.inventoryPrivateTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.inventoryPrivateDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.inventoryItem", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryBarcode", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryStatus", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryAssignedWorker", currentLang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {privateAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {t("admin.inventoryNoPrivateItems", currentLang)}
                  </TableCell>
                </TableRow>
              ) : (
                privateAssets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.barcode ?? "-"}</TableCell>
                    <TableCell>{t("admin.inventoryStatusPrivate", currentLang)}</TableCell>
                    <TableCell>{`${item.worker.firstName} ${item.worker.lastName}`.trim()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.inventoryMovementHistory", currentLang)}</CardTitle>
          <CardDescription>{t("admin.inventoryMovementDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.inventoryAction", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryItem", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryBarcode", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryWho", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryWorker", currentLang)}</TableHead>
                <TableHead>{t("admin.inventoryWhen", currentLang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{movement.action}</TableCell>
                  <TableCell>{movement.item?.name ?? movement.note ?? t("admin.inventoryPrivateItem", currentLang)}</TableCell>
                  <TableCell>{movement.barcode ?? "-"}</TableCell>
                  <TableCell>{movement.actorName ?? movement.actorRole ?? "-"}</TableCell>
                  <TableCell>{movement.worker ? `${movement.worker.firstName} ${movement.worker.lastName}`.trim() : "-"}</TableCell>
                  <TableCell>{new Date(movement.createdAt).toLocaleString(localeForLanguage(currentLang))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

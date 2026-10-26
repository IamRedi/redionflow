import Link from "next/link";

import { BarcodeLabel } from "@/components/inventory/barcode-label";
import { PrintButton } from "@/components/print/PrintButton";
import { Button } from "@/components/ui/button";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

function parseIds(value: string | string[] | undefined) {
  const joined = Array.isArray(value) ? value.join(",") : value ?? "";
  return joined
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCopies(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const copies = Number(raw ?? 1);
  return Number.isFinite(copies) ? Math.max(1, Math.min(48, Math.floor(copies))) : 1;
}

export default async function InventoryPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ids = parseIds(params.ids);
  const copies = parseCopies(params.copies);
  const [company, currentLang] = await Promise.all([getOrCreateDefaultCompany(), resolveRequestLanguage()]);
  const t = getTranslator(currentLang);
  const items = ids.length
    ? await prisma.companyInventoryItem.findMany({
        where: { companyProfileId: company.id, id: { in: ids } },
        orderBy: { itemCode: "asc" },
      })
    : [];

  const stickers = items.flatMap((item) => Array.from({ length: copies }, (_, index) => ({ item, index })));

  return (
    <div className="mx-auto max-w-7xl space-y-4 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href="/app/admin/inventory">{t("common.back")}</Link>
        </Button>
        <PrintButton />
      </div>

      <div className="rounded-xl border bg-white p-4 text-black print:border-0 print:p-0">
        <div className="mb-4 print:hidden">
          <div className="text-lg font-semibold">{t("admin.stickerPreview")}</div>
          <div className="text-sm text-black/65">{t("admin.stickerPreviewDescription")}</div>
        </div>

        <div
          className="grid gap-3 print:gap-2"
          style={{
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {stickers.map(({ item, index }) => (
            <div
              key={`${item.id}-${index}`}
              className="break-inside-avoid"
              style={{ minHeight: "8.7cm" }}
            >
              <BarcodeLabel value={item.barcode ?? item.itemCode} title={item.name} shortCode={item.itemCode} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

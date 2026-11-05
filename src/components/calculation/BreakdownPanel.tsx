import { formatMoney } from "@/lib/calculation/formatters";
import type { PositionTotals } from "@/lib/calculation/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function BreakdownPanel({
  title,
  totals,
  t,
  currentLang = "de",
  currency = "EUR",
}: {
  title: string;
  totals: PositionTotals;
  t: (path: string) => string;
  currentLang?: string;
  currency?: string;
}) {
  const d = totals.direct;
  const o = totals.overhead;
  const offer = totals.offer;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t("form.breakdownPath")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">{t("form.breakdownLaborDirect")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.laborCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownMachinesDirect")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.machineCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownMaterialDirect")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.materialCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownExternalDirect")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.externalCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownManualAdjustment")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.manualAdjustmentCents ?? 0, currentLang, currency)}</span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 font-medium">
          <span>{t("form.breakdownEk")}</span>
          <span className="text-right tabular-nums">{formatMoney(d.ekCents, currentLang, currency)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">{t("form.breakdownBgkBase")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.bgkBaseCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownBgk")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.bgkCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownHk")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.hkCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownAgk")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.agkCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownSk")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.skCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownRisk")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.riskCents, currentLang, currency)}</span>
          <span className="text-muted-foreground">{t("form.breakdownProfit")}</span>
          <span className="text-right tabular-nums">{formatMoney(o.profitCents, currentLang, currency)}</span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 text-base font-semibold">
          <span>{t("form.breakdownOfferNet")}</span>
          <span className="text-right tabular-nums">{formatMoney(offer.netCents, currentLang, currency)}</span>
          <span className="text-muted-foreground text-sm font-normal">{t("form.vat")}</span>
          <span className="text-right tabular-nums text-sm font-normal">{formatMoney(offer.vatCents, currentLang, currency)}</span>
          <span className="text-muted-foreground text-sm font-normal">{t("form.gross")}</span>
          <span className="text-right tabular-nums text-sm font-normal">{formatMoney(offer.grossCents, currentLang, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

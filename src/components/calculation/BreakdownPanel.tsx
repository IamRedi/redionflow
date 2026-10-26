import { formatEUR } from "@/lib/calculation/formatters";
import type { PositionTotals } from "@/lib/calculation/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function BreakdownPanel({
  title,
  totals,
  t,
  currentLang = "de",
}: {
  title: string;
  totals: PositionTotals;
  t: (path: string) => string;
  currentLang?: string;
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
          <span className="text-right tabular-nums">{formatEUR(d.laborCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownMachinesDirect")}</span>
          <span className="text-right tabular-nums">{formatEUR(d.machineCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownMaterialDirect")}</span>
          <span className="text-right tabular-nums">{formatEUR(d.materialCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownExternalDirect")}</span>
          <span className="text-right tabular-nums">{formatEUR(d.externalCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownManualAdjustment")}</span>
          <span className="text-right tabular-nums">{formatEUR(d.manualAdjustmentCents ?? 0, currentLang)}</span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 font-medium">
          <span>{t("form.breakdownEk")}</span>
          <span className="text-right tabular-nums">{formatEUR(d.ekCents, currentLang)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">{t("form.breakdownBgkBase")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.bgkBaseCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownBgk")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.bgkCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownHk")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.hkCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownAgk")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.agkCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownSk")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.skCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownRisk")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.riskCents, currentLang)}</span>
          <span className="text-muted-foreground">{t("form.breakdownProfit")}</span>
          <span className="text-right tabular-nums">{formatEUR(o.profitCents, currentLang)}</span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 text-base font-semibold">
          <span>{t("form.breakdownOfferNet")}</span>
          <span className="text-right tabular-nums">{formatEUR(offer.netCents, currentLang)}</span>
          <span className="text-muted-foreground text-sm font-normal">{t("form.vat")}</span>
          <span className="text-right tabular-nums text-sm font-normal">{formatEUR(offer.vatCents, currentLang)}</span>
          <span className="text-muted-foreground text-sm font-normal">{t("form.gross")}</span>
          <span className="text-right tabular-nums text-sm font-normal">{formatEUR(offer.grossCents, currentLang)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

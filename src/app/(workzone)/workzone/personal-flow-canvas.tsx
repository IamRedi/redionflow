import { CheckCircle2, ListTodo, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyMode } from "@/lib/mode-config";
import { t } from "@/lib/i18n";

type PersonalFlowCanvasProps = {
  productName: string;
  canEdit: boolean;
  currentLang: string;
  mode: CompanyMode;
};

/**
 * T-030 — PersonalFlow simplified surface.
 *
 * Personal mode hides Baustellen, Trees, Machines, GPS, Inventory. What
 * remains is a lightweight Tasks + Reminders view. We render a calm empty
 * state today so PersonalFlow tenants land on a coherent page instead of
 * the mission-control canvas that assumes Baustellen exist.
 *
 * Full Tasks and Reminders modules land as follow-up work — this component
 * intentionally keeps the surface small and honest about the current scope.
 */
export function PersonalFlowCanvas({
  productName,
  canEdit,
  currentLang,
  mode,
}: PersonalFlowCanvasProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" />
          <span>{productName}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("workzone.title", currentLang, mode)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? t("workzone.personalFlowIntro", currentLang, mode)
            : t("workzone.personalFlowLoginRequired", currentLang, mode)}
        </p>
      </header>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ListTodo className="mt-0.5 size-5 text-muted-foreground" />
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">{t("workzone.personalFlowTasks", currentLang, mode)}</CardTitle>
            <CardDescription>
              {t("workzone.personalFlowTasksDescription", currentLang, mode)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("workzone.personalFlowNoTasks", currentLang, mode)}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <CheckCircle2 className="mt-0.5 size-5 text-muted-foreground" />
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">{t("workzone.personalFlowReminders", currentLang, mode)}</CardTitle>
            <CardDescription>
              {t("workzone.personalFlowRemindersDescription", currentLang, mode)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("workzone.personalFlowNoReminders", currentLang, mode)}
        </CardContent>
      </Card>
    </div>
  );
}

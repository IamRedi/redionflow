"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { addExternalWorkerToBaustelleAction } from "../../actions";

type CurrentWorker = { id: string; firstName: string; lastName: string; isAdmin?: boolean } | null;

export function ExternalWorkerForm({ baustelleId, currentWorker }: { baustelleId: string; currentWorker: CurrentWorker }) {
  const { currentLang } = useLanguage();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentWorker) {
    return <p className="text-sm text-muted-foreground">{t("workzone.externalWorkerPermission", currentLang)}</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        const form = new FormData(event.currentTarget);
        const result = await addExternalWorkerToBaustelleAction({
          baustelleId,
          addedByWorkerId: currentWorker.id,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          phone: form.get("phone"),
        });
        setBusy(false);
        setMessage(result.message ?? null);
        if (result.ok) {
          event.currentTarget.reset();
        }
      }}
    >
      <div className="grid gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="externalFirstName">{t("workzone.firstName", currentLang)}</Label>
          <Input id="externalFirstName" name="firstName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="externalLastName">{t("workzone.lastName", currentLang)}</Label>
          <Input id="externalLastName" name="lastName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="externalPhone">{t("common.phone", currentLang)}</Label>
          <Input id="externalPhone" name="phone" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        <UserPlus className="size-4" />
        {t("workzone.addExternalWorker", currentLang)}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

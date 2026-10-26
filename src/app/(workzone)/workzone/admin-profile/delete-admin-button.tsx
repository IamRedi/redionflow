"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { removeManagedTestAdminAction } from "@/app/(admin)/app/profile/actions";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";

export function DeleteAdminButton({ adminId, adminLabel }: { adminId: string; adminLabel: string }) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeAdmin() {
    startTransition(async () => {
      const result = await removeManagedTestAdminAction(adminId);
      setMessage(result.message ?? null);
      if (result.ok) {
        setOpen(false);
        router.push("/workzone");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)} disabled={isPending}>
        <Trash2 className="size-4" />
        {t("admin.removeAdmin", currentLang)}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <SimpleDialog
        open={open}
        title={t("admin.removeAdmin", currentLang)}
        description={t("admin.confirmRemoveAdmin", currentLang).replace("{name}", adminLabel)}
        confirmLabel={t("common.delete", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        confirmVariant="destructive"
        confirmDisabled={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={removeAdmin}
      />
    </>
  );
}

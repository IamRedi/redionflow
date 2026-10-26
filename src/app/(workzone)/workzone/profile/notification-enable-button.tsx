"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { enableNotifications } from "@/lib/notifications/notification-client";

export function NotificationEnableButton() {
  const { currentLang } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await enableNotifications();
            setMessage(result.message);
          });
        }}
      >
        <Bell className="size-4" />
        {t("workzone.enableNotifications", currentLang)}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Language } from "@/lib/i18n";
import { saveCompanyLogoAction } from "./actions";

export function CompanyLogoForm({ currentLang, logo, companyName }: { currentLang: Language; logo: string | null; companyName: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(remove: boolean) {
    const data = new FormData();
    data.set("lang", currentLang);
    if (remove) data.set("remove", "1");
    else {
      const file = inputRef.current?.files?.[0];
      if (!file) return;
      data.set("logo", file);
    }
    startTransition(async () => {
      const result = await saveCompanyLogoAction(data);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) {
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.settingsLogoTitle", currentLang)}</CardTitle>
        <CardDescription>{t("admin.settingsLogoDescription", currentLang)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-48 items-center justify-center rounded-md border bg-white p-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small data: URL preview
            <img src={logo} alt={companyName} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-500">{t("admin.settingsLogoEmpty", currentLang)}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            aria-label={t("admin.settingsLogoTitle", currentLang)}
            className="max-w-full text-sm"
            onChange={() => submit(false)}
            disabled={isPending}
          />
          {logo ? (
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => submit(true)}>
              {t("admin.settingsLogoRemove", currentLang)}
            </Button>
          ) : null}
        </div>
        {message ? (
          <p className={`w-full text-sm ${message.ok ? "text-green-700 dark:text-green-300" : "text-destructive"}`}>{message.text}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

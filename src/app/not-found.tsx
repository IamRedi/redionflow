import Link from "next/link";
import { cookies } from "next/headers";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { LANGUAGE_COOKIE, normalizeLanguage } from "@/lib/i18n/language";

/**
 * Root not-found boundary. Rendered when navigation lands on a URL
 * that no route matches. We can't call resolveRequestLanguage() here
 * because Next.js runs not-found in a restricted context, so we read
 * the cookie directly and fall back to German.
 */
export default async function NotFoundPage() {
  const jar = await cookies();
  const currentLang = normalizeLanguage(jar.get(LANGUAGE_COOKIE)?.value) ?? "de";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("admin.notFoundTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.notFoundDescription", currentLang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">{t("admin.goHome", currentLang)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

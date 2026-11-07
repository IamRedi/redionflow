import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyMode } from "@/lib/db/company";
import { productBranding } from "@/lib/mode-config";
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { siteAccessCopy } from '@/lib/site-phase-documents/access-copy';
import { WorkerLoginForm } from "./login-form";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WorkerLoginPage() {
  const copy=siteAccessCopy(await resolveRequestLanguage());
  const mode = await getCompanyMode();
  const branding = productBranding(mode);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">
            {branding.name}{branding.suffix}<sup className="text-[10px]">{branding.superscript}</sup>
          </div>
          <CardTitle>{copy.pinTitle}</CardTitle>
          <CardDescription>{copy.loginHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkerLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}

import type { ReactNode } from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";

import { DemoTopBar } from "@/components/demo/demo-top-bar";
import { DemoMachineRail } from "@/components/demo/demo-machine-rail";
import { WorkshopFleet } from "@/components/demo/workshop/workshop-fleet";
import { DemoWorkspace } from "@/components/demo/demo-workspace";
import shellStyles from "@/components/demo/demo-workspace.module.css";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { LiveRefreshListener } from "@/components/realtime/live-refresh-listener";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { getFeatures } from "@/lib/mode-config";
import { prisma } from "@/lib/db/prisma";
import { getMachineSidebarData } from "@/lib/workzone/machine-sidebar-data";
import { isPublicDemoEnabled } from "@/lib/public-demo";

export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default async function DemoLayout({ children }: { children: ReactNode }) {
  // No login on these pages: never serve them outside a demo/local instance.
  if (!isPublicDemoEnabled()) notFound();
  const company = await getOrCreateDefaultCompany();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const [workers, machines, announcement, mode] = await Promise.all([
    prisma.worker.findMany({
      where: { companyProfileId: company.id, status: "active" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        availability: true,
        birthDate: true,
        profileImageUrl: true,
        phone: true,
        emailAccount: true,
        sessions: {
          where: { isLive: true, endTime: null },
          select: { id: true },
          take: 1,
        },
        vacationRequests: {
          where: {
            status: "APPROVED",
            startDate: { lte: todayEnd },
            endDate: { gte: todayStart },
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    getMachineSidebarData(),
    prisma.workzoneAnnouncement.findFirst({
      where: { companyProfileId: company.id, isActive: true },
      select: { message: true },
      orderBy: { createdAt: "desc" },
    }),
    getCompanyMode(),
  ]);
  const features = getFeatures(mode);
  // Mirrors the real Workzone layout: theme background, dark green only in dark mode.
  const pageTone = mode === "baumdienst" ? "dark:bg-[#10211a]" : "";

  return (
    <div className={`${mode === "baumdienst" ? shellStyles.shell : "min-h-dvh overflow-x-hidden"} bg-background text-foreground ${pageTone}`}>
      <header className={mode === "baumdienst" ? `${shellStyles.header} relative z-10 bg-transparent print:hidden` : `sticky top-0 z-10 bg-background/90 backdrop-blur print:hidden ${pageTone}`}>
        <div className="pt-3">
          <DemoTopBar
            mode={mode}
            workers={workers.map((worker) => ({
              id: worker.id,
              firstName: worker.firstName,
              lastName: worker.lastName,
              availability: worker.vacationRequests.length > 0 ? "VACATION" : worker.availability,
              birthDate: worker.birthDate ? worker.birthDate.toISOString() : null,
              profileImageUrl: worker.profileImageUrl,
              phone: worker.phone,
              emailAccount: worker.emailAccount,
              live: worker.sessions.length > 0,
            }))}
          />
          {announcement?.message && mode !== "baumdienst" ? (
            <div className="mx-auto max-w-6xl px-5 pb-2 lg:pr-20">
              <div className="rounded-md border bg-card px-3 py-2 text-sm">{announcement.message}</div>
            </div>
          ) : null}
        </div>
      </header>
      {features.machines ? mode === "baumdienst" ? <WorkshopFleet machines={machines} now={new Date().toISOString()} /> : <DemoMachineRail machines={machines} /> : null}
      <LiveRefreshListener enabled />
      {mode === "baumdienst" ? <><DemoWorkspace>{children}</DemoWorkspace><div className={shellStyles.footer}><RediOnFooter compact /></div></> : <div className="mx-auto max-w-6xl lg:pr-20">
        <main className="px-5 pb-24 pt-4 lg:pb-6 print:max-w-none print:px-0 print:py-0">{children}</main>
        <RediOnFooter />
      </div>}
    </div>
  );
}

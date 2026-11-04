import type { ReactNode } from "react";
import { LiveRefreshListener } from "@/components/realtime/live-refresh-listener";
import { FlowTopBar } from "@/components/shell/FlowTopBar";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCompanyCountry, getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { getFeatures } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import { prisma } from "@/lib/db/prisma";
import { fleetShowsCones, getMachineSidebarData } from "@/lib/workzone/machine-sidebar-data";
import { autoCloseForgottenDaySessions } from "@/lib/workzone/session-rules";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { MachineSidebar } from "./machine-sidebar";
import { crewPermissions } from "@/lib/workzone/crew-roles";
import { OfflineStatusBar } from "./offline-status-bar";
import { WorkzoneAnnouncementBar } from "./workzone-announcement-bar";
import { WorkzoneSyncRunner } from "./workzone-sync-runner";
import { isSteelCompany } from "@/lib/dashboard/steel-access";
import { WorkzoneMapFleet } from "./workzone-map-fleet";

export default async function WorkzoneLayout({ children }: { children: ReactNode }) {
  await autoCloseForgottenDaySessions();
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (isSaasMode && !admin && !worker) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
        <div className="mx-auto w-full max-w-6xl">
          <main className="px-5 py-6">{children}</main>
          <RediOnFooter />
        </div>
      </div>
    );
  }
  const company = await getOrCreateDefaultCompany();
  const [machines, announcement, mode, showCones, country] = await Promise.all([
    getMachineSidebarData(),
    prisma.workzoneAnnouncement.findFirst({
      where: { companyProfileId: company.id, isActive: true },
      select: { message: true, createdByName: true },
      orderBy: { createdAt: "desc" },
    }),
    getCompanyMode(),
    fleetShowsCones(),
    getCompanyCountry(),
  ]);
  const features = getFeatures(mode);
  const production = mode === "bau" && await isSteelCompany(company.id);

  return (
    <WorkzoneMapFleet vehicles={machines.filter(m => m.isActive).map(m => ({ id: m.id, name: m.nickname || m.name, plate: m.targe }))}>
    <div
      className={`min-h-dvh overflow-x-hidden bg-background text-foreground ${
        mode === "baumdienst" ? "dark:bg-[#10211a]" : ""
      }`}
    >
      <header data-testid="workzone-topbar" className={production ? "relative z-10 print:hidden" : "sticky top-0 z-10 print:hidden"}>
        <div className={production ? "" : "pt-3"}>
          <FlowTopBar contained={production} announcementMessage={announcement?.message ?? null} />
          <div className="mx-auto max-w-6xl space-y-1.5 px-5 pb-2 lg:pr-20">
            <WorkzoneAnnouncementBar
              message={announcement?.message ?? null}
              authorName={announcement?.createdByName ?? null}
            />
            <OfflineStatusBar />
          </div>
        </div>
      </header>
      {features.machines ? <MachineSidebar machines={machines} isAdmin={Boolean(admin)} canEditPhotos={crewPermissions(admin?{isAdmin:true}:worker?{isAdmin:false,crewRole:worker.crewRole,level:worker.level}:null).office} showCones={showCones} country={country} /> : null}
      <WorkzoneSyncRunner />
      <LiveRefreshListener enabled />
      <div className="mx-auto w-full max-w-6xl lg:pr-20">
        <main className="px-5 py-6 print:max-w-none print:px-0 print:py-0">{children}</main>
        <RediOnFooter />
      </div>
    </div>
    </WorkzoneMapFleet>
  );
}

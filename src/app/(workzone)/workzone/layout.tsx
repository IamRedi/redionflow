import { currentMaySeePrivateVehicles } from "@/lib/fleet/private-vehicles";
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
import { OfflineStatusBar } from "./offline-status-bar";
import { WorkzoneAnnouncementBar } from "./workzone-announcement-bar";
import { WorkzoneSyncRunner } from "./workzone-sync-runner";
import { isSteelCompany } from "@/lib/dashboard/steel-access";
import { WorkzoneMapFleet } from "./workzone-map-fleet";
import workspace from '@/components/shell/app-workspace.module.css';
import { currentCompanyActor } from "@/lib/site-files/actor";

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
  const companyActor = worker ? await currentCompanyActor(company.id) : null;
  const canSeeWorkshop = !worker || Boolean(companyActor?.allows("workshop.view"));
  const canSetPrivateVehicles = await currentMaySeePrivateVehicles();
  // Vehicle photos: office, or "Vepron" on Flota dhe GPS (key button).
  const canEditMachinePhotos = !worker ? Boolean(admin) : Boolean(companyActor && (companyActor.can.office || companyActor.allows("fleet_gps.manage")));
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
    <WorkzoneMapFleet enhancedOperations={production} statusMachines={machines.map(({ id, operationalStatus }) => ({ id, operationalStatus }))} vehicles={machines.filter(m => m.isActive).map(m => ({ id: m.id, name: m.nickname || m.name, plate: m.targe, operationalStatus: m.operationalStatus }))}>
    <div
      className={`${production ? workspace.shell : 'min-h-dvh overflow-x-hidden'} bg-background text-foreground ${
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
      {!production && features.machines ? <MachineSidebar machines={machines} isAdmin={Boolean(admin)} canEditPhotos={canEditMachinePhotos} showCones={showCones} country={country} /> : null}
      <WorkzoneSyncRunner />
      <LiveRefreshListener enabled />
      <div className={production ? `${workspace.body} ${workspace.workzone}` : 'mx-auto w-full max-w-6xl lg:pr-20'}>
        <main data-testid={production ? 'app-workspace-scroll' : undefined} tabIndex={production ? 0 : undefined} className={production ? workspace.scroll : 'px-5 py-6 print:max-w-none print:px-0 print:py-0'}>{production ? <><div className={workspace.page}>{children}</div><RediOnFooter /></> : children}</main>
        {production && features.machines ? <MachineSidebar embedded enhancedOperations canSetPrivate={canSetPrivateVehicles} canSeeWorkshop={canSeeWorkshop} machines={machines} isAdmin={Boolean(admin)} canEditPhotos={canEditMachinePhotos} showCones={showCones} country={country} /> : null}
        {!production && <RediOnFooter />}
      </div>
    </div>
    </WorkzoneMapFleet>
  );
}

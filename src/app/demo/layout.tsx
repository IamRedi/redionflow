import type { ReactNode } from "react";

import { DemoTopBar } from "@/components/demo/demo-top-bar";
import { DemoMachineRail } from "@/components/demo/demo-machine-rail";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { LiveRefreshListener } from "@/components/realtime/live-refresh-listener";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getMachineSidebarData } from "@/lib/workzone/machine-sidebar-data";

export default async function DemoLayout({ children }: { children: ReactNode }) {
  const company = await getOrCreateDefaultCompany();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const [workers, machines, announcement] = await Promise.all([
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
  ]);

  return (
    <div className="min-h-dvh bg-[#10211a]">
      <header className="sticky top-0 z-10 print:hidden">
        <div className="pt-3">
          <DemoTopBar
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
          {announcement?.message ? (
            <div className="mx-auto max-w-6xl px-5 pb-2 lg:pr-20">
              <div className="rounded-md border bg-card px-3 py-2 text-sm">{announcement.message}</div>
            </div>
          ) : null}
        </div>
      </header>
      <DemoMachineRail machines={machines} />
      <LiveRefreshListener enabled />
      <div className="mx-auto max-w-6xl lg:pr-20">
        <main className="px-5 py-6 print:max-w-none print:px-0 print:py-0">{children}</main>
        <RediOnFooter />
      </div>
    </div>
  );
}

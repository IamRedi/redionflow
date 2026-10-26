import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { DisplayTopBar } from "@/components/display/display-top-bar";
import { getCurrentDisplayUser } from "@/lib/auth/display-session";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";

export default async function DisplayLayout({ children }: { children: ReactNode }) {
  const displayUser = await getCurrentDisplayUser();
  if (!displayUser) redirect("/display-login");

  const company = await getOrCreateDefaultCompany();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const workers = await prisma.worker.findMany({
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
  });

  return (
    <div className="min-h-dvh bg-[#10211a]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#10211a]/96 backdrop-blur">
        <DisplayTopBar
          initialTimestamp={new Date().toISOString()}
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
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">
        <main>{children}</main>
        <RediOnFooter />
      </div>
    </div>
  );
}

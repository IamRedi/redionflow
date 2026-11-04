import Link from 'next/link';
import { Bell, Home, LayoutDashboard } from 'lucide-react';

import {
  TeamAssistantLogoTrigger,
  WorkerAssistantTrigger,
} from '@/components/assistant/team-assistant';
import { AppBrand } from '@/components/branding/AppBrand';
import { Button } from '@/components/ui/button';
import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { getCompanyMode } from '@/lib/db/company';
import { prisma } from '@/lib/db/prisma';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { t } from '@/lib/i18n';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { getCurrentWorker } from '@/lib/workzone/worker-session';
import { safeCompanyLogo } from '@/lib/company-logo';
import { WorkerIconStrip } from '@/app/(workzone)/workzone/worker-icon-strip';
import { notifyTeamAction } from '@/app/(workzone)/workzone/announcement-actions';
import { TopbarAnnouncementButton } from '@/app/(workzone)/workzone/topbar-announcement-button';

function adminInitial(value: string | null | undefined) {
  const source = value?.trim();
  if (!source) return '?';
  return source.charAt(0).toUpperCase();
}

export async function FlowTopBar({
  announcementMessage = null,
  contained = false,
}: { announcementMessage?: string | null; contained?: boolean } = {}) {
  const admin = await getCurrentAdmin();
  const currentLang = await resolveRequestLanguage();
  const [companyMode, tenantId] = await Promise.all([
    getCompanyMode(),
    getCurrentCompanyId(),
  ]);
  const currentWorkerId = (await getCurrentWorker())?.id;

  // T-025b / SaaS: scope workers + admin profiles to the caller's tenant so
  // the top bar never leaks staff from another company.
  const tenantWhere = tenantId ? { companyProfileId: tenantId } : {};

  const vacationDecisionSince = new Date();
  vacationDecisionSince.setDate(vacationDecisionSince.getDate() - 14);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const [workers, adminProfiles] = await Promise.all([
    prisma.worker.findMany({
      where: { status: 'active', ...tenantWhere },
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
          orderBy: { startTime: 'desc' },
          select: { id: true, startTime: true, isLive: true, endTime: true },
          take: 6,
        },
        vacationRequests: {
          where: {
            OR: [
              { status: 'PENDING' },
              {
                status: 'APPROVED',
                startDate: { lte: todayEnd },
                endDate: { gte: todayStart },
              },
              {
                status: { in: ['APPROVED', 'REJECTED'] },
                reviewedAt: { gte: vacationDecisionSince },
              },
            ],
          },
          orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            reviewedAt: true,
          },
          take: 5,
        },
      },
    }),
    admin
      ? prisma.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true,
            isOwner: false,
            ...tenantWhere,
          },
          select: { id: true, name: true, email: true },
          orderBy: [{ name: 'asc' }, { email: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const workersSorted = workers
    .map((worker) => {
      const liveSession =
        worker.sessions.find((session) => session.isLive && !session.endTime) ??
        null;
      const latestSession = worker.sessions[0] ?? null;
      const recentVacationDecisionRequests = worker.vacationRequests.filter(
        (request) =>
          (request.status === 'APPROVED' || request.status === 'REJECTED') &&
          request.reviewedAt &&
          request.reviewedAt >= vacationDecisionSince,
      );
      return {
        ...worker,
        liveSession,
        latestSessionAtMs: latestSession?.startTime?.getTime?.() ?? 0,
        recentVacationDecisionRequests,
      };
    })
    .sort((a, b) => {
      const aLive = a.liveSession ? 1 : 0;
      const bLive = b.liveSession ? 1 : 0;
      if (bLive !== aLive) return bLive - aLive;
      if (b.latestSessionAtMs !== a.latestSessionAtMs)
        return b.latestSessionAtMs - a.latestSessionAtMs;
      return `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
        'de',
      );
    });

  const mobileAdminProfiles = adminProfiles.slice(0, 3);
  const companyBrand = tenantId
    ? await prisma.companyProfile.findUnique({
        where: { id: tenantId },
        select: { displayName: true, logoDataUrl: true },
      })
    : null;
  const companyLogo = safeCompanyLogo(companyBrand?.logoDataUrl);

  return (
    <div className={contained ? "mx-auto w-full min-w-0 max-w-[2000px] px-4 py-3 sm:px-5 lg:pr-24" : "mx-auto grid min-h-[158px] w-full min-w-0 max-w-6xl gap-2 px-4 pb-1 pt-8 sm:px-5 lg:min-h-[104px]"}>
      <div className={`grid grid-cols-[auto_minmax(0,1fr)] ${contained ? "items-center" : "items-start"} gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]`}>
        {/* Admin production pages use separate columns; Workzone keeps its existing floating layout. */}
        <div className={`pointer-events-none relative z-10 ${contained ? "col-span-2 flex-row items-center justify-between lg:col-span-1 lg:flex-col" : "col-start-1 row-start-1 flex-col"} flex gap-2 [&_a]:pointer-events-auto [&_button]:pointer-events-auto`}>
          <div className={`flex items-center gap-2 ${contained ? "shrink-0" : ""}`}>
            {admin ? (
              <TeamAssistantLogoTrigger
                compact
                mode={companyMode}
                companyLogo={companyLogo}
              />
            ) : currentWorkerId ? (
              <WorkerAssistantTrigger
                compact
                mode={companyMode}
                companyLogo={companyLogo}
              />
            ) : (
              <AppBrand
                compact
                mode={companyMode}
                companyLogo={companyLogo}
                logoAlt={t('common.companyLogoAlt', currentLang)}
              />
            )}
            <div className="grid gap-1">
              <Link
                href="/workzone"
                title={t('workzone.title', currentLang)}
                aria-label={t('workzone.title', currentLang)}
                className="inline-flex size-8 items-center justify-center rounded-full border bg-background/80 text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
              >
                <Home className="size-4" />
              </Link>
              {admin ? (
                <Link
                  href="/app/dashboard"
                  title={t('workzone.admin', currentLang)}
                  aria-label={t('workzone.admin', currentLang)}
                  className="inline-flex size-8 items-center justify-center rounded-full border bg-background/80 text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
                >
                  <LayoutDashboard className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>

          {admin || mobileAdminProfiles.length > 0 ? (
            <div className={contained ? "no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto lg:hidden [&>*]:shrink-0" : "flex items-center gap-2 lg:hidden"}>
              {admin ? (
                <>
                  <TopbarAnnouncementButton message={announcementMessage} />
                  <form action={notifyTeamAction}>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full bg-background/85 text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground"
                      title={t('workzone.notifyTeam', currentLang)}
                      aria-label={t('workzone.notifyTeam', currentLang)}
                    >
                      <Bell className="size-4" />
                    </Button>
                  </form>
                </>
              ) : null}
              {mobileAdminProfiles.map((profile) => (
                <Link
                  key={profile.id}
                  href={`/workzone/admin-profile/${profile.id}`}
                  title={`${t('admin.profile', currentLang)}: ${profile.name ?? profile.email}`}
                  aria-label={`${t('admin.profile', currentLang)}: ${profile.name ?? profile.email}`}
                  className="inline-flex size-9 items-center justify-center rounded-full border bg-background/85 text-xs font-semibold text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
                >
                  {adminInitial(profile.name ?? profile.email)}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div data-testid="flow-team-strip" className={contained ? "col-span-2 min-w-0 rounded-2xl border bg-card/75 px-2 py-2 lg:col-span-1" : "col-start-1 col-end-3 row-start-1 min-w-0"}>
          <WorkerIconStrip
            insetClassName={contained ? "" : "pl-[124px]"}
            admin={Boolean(admin)}
            workers={workersSorted.map((worker) => ({
              id: worker.id,
              firstName: worker.firstName,
              lastName: worker.lastName,
              availability: worker.vacationRequests.some(
                (request) =>
                  request.status === 'APPROVED' &&
                  request.startDate <= todayEnd &&
                  request.endDate >= todayStart,
              )
                ? 'VACATION'
                : worker.availability,
              birthDate: worker.birthDate
                ? worker.birthDate.toISOString()
                : null,
              profileImageUrl: worker.profileImageUrl,
              phone: worker.phone,
              emailAccount: worker.emailAccount,
              live: Boolean(worker.liveSession),
              activeProfile: worker.id === currentWorkerId,
              pendingVacationRequest: worker.vacationRequests.some(
                (request) => request.status === 'PENDING',
              ),
              vacationDecisionSignal:
                worker.id === currentWorkerId &&
                worker.recentVacationDecisionRequests.length > 0,
              vacationDecisionSignalKey:
                worker.id === currentWorkerId
                  ? (worker.recentVacationDecisionRequests[0]?.reviewedAt?.toISOString() ??
                    null)
                  : null,
            }))}
          />
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {admin ? (
            <>
              <TopbarAnnouncementButton message={announcementMessage} />
              <form action={notifyTeamAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full bg-background/85 text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground"
                  title={t('workzone.notifyTeam', currentLang)}
                  aria-label={t('workzone.notifyTeam', currentLang)}
                >
                  <Bell className="size-4" />
                </Button>
              </form>
            </>
          ) : null}
          {adminProfiles.map((profile) => (
            <Link
              key={profile.id}
              href={`/workzone/admin-profile/${profile.id}`}
              title={`${t('admin.profile', currentLang)}: ${profile.name ?? profile.email}`}
              aria-label={`${t('admin.profile', currentLang)}: ${profile.name ?? profile.email}`}
              className="inline-flex size-9 items-center justify-center rounded-full border bg-background/85 text-xs font-semibold text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
            >
              <span>{adminInitial(profile.name ?? profile.email)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { publicMusterProfile, publicMusterSubject } from './public-muster';
import { readBlueprint } from '@/lib/provision/blueprints';

/** Never selects an arbitrary user, first tenant or a client-provided account ID. */
export async function getBauflowDemoAccount(role: string) {
  const profile = publicMusterProfile();
  const subject = publicMusterSubject(role);
  if (!profile || !subject || await prisma.companyProfile.count() !== 1) return null;
  const company = await prisma.companyProfile.findUnique({
    where: { id: profile.companyId },
    select: { mode: true, legalName: true, uiIdentity: true, setupProfile: true },
  });
  if (company?.mode !== 'bau' || company.legalName !== profile.legalName) return null;
  if(profile.crane) {
    try { if(company.uiIdentity!=='crane-red-blue-v1'||readBlueprint(company.setupProfile)?.factory!==false)return null; }
    catch { return null; }
  }
  if (subject.kind === 'admin') {
    const account = await prisma.user.findFirst({
      where: { id: subject.id, companyProfileId: profile.companyId, role: 'ADMIN', isOwner: true, isActive: true },
      select: { id: true, sessionEpoch: true },
    });
    return account ? { ...account, kind: subject.kind } : null;
  }
  const workerWhere = {
    id: subject.id, companyProfileId: profile.companyId,
    crewRole: subject.role, status: 'active',
  } satisfies Prisma.WorkerWhereInput;
  const account = await prisma.worker.findFirst({
    where: workerWhere,
    select: { id: true, sessionEpoch: true },
  });
  return account ? { ...account, kind: subject.kind } : null;
}

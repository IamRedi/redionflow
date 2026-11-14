import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { BAUFLOW_MUSTER_COMPANY_ID, bauflowDemoSubject } from './bauflow-muster';

/** Never selects an arbitrary user, first tenant or a client-provided account ID. */
export async function getBauflowDemoAccount(role: string) {
  const subject = bauflowDemoSubject(role);
  if (!subject || await prisma.companyProfile.count() !== 1) return null;
  const company = await prisma.companyProfile.findUnique({
    where: { id: BAUFLOW_MUSTER_COMPANY_ID },
    select: { mode: true, legalName: true },
  });
  if (company?.mode !== 'bau' || company.legalName !== 'BauFlow Musterbau GmbH · Fiktive Demofirma') return null;
  if (subject.kind === 'admin') {
    const account = await prisma.user.findFirst({
      where: { id: subject.id, companyProfileId: BAUFLOW_MUSTER_COMPANY_ID, role: 'ADMIN', isOwner: true, isActive: true },
      select: { id: true, sessionEpoch: true },
    });
    return account ? { ...account, kind: subject.kind } : null;
  }
  const workerWhere = {
    id: subject.id, companyProfileId: BAUFLOW_MUSTER_COMPANY_ID,
    crewRole: subject.role, status: 'active',
  } satisfies Prisma.WorkerWhereInput;
  const account = await prisma.worker.findFirst({
    where: workerWhere,
    select: { id: true, sessionEpoch: true },
  });
  return account ? { ...account, kind: subject.kind } : null;
}

import { z } from 'zod';

// Explicit immutable account IDs, never names/emails or an implicit admin bypass.
// An absent/invalid configuration keeps this first release completely closed.
const member = z.object({ adminId: z.string().min(1), workerId: z.string().min(1).optional() }).strict();
const config = z.object({ companyId: z.string().min(1), megi: member, almet: member }).strict();
export type OfficeSeat = 'megi' | 'almet' | 'staff';
export type OfficeIdentity = { kind: 'admin' | 'worker'; id: string; companyId: string };

export function officeSeat(raw: string | undefined, actor: OfficeIdentity | null): OfficeSeat | null {
  if (!raw || !actor) return null;
  try {
    const result = config.safeParse(JSON.parse(raw));
    if (!result.success || result.data.companyId !== actor.companyId) return null;
    const c = result.data;
    if (c.megi.adminId === c.almet.adminId || (c.megi.workerId && c.megi.workerId === c.almet.workerId)) return null;
    const key = actor.kind === 'admin' ? 'adminId' : 'workerId';
    return c.megi[key] === actor.id ? 'megi' : c.almet[key] === actor.id ? 'almet' : null;
  } catch { return null; }
}

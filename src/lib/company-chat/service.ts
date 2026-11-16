import { withTenantContext } from '@/lib/db/tenant-context';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import { sendNotification } from '@/lib/notifications/sendNotification';
import { CHAT_HISTORY_LIMIT, CHAT_PAGE_SIZE, ChatError, type ChatCommand, type ChatIdentity, type ChatSnapshot } from './contract';

export async function companyChatSnapshot(actor: ChatIdentity, options: { before?: bigint; summary?: boolean } = {}): Promise<ChatSnapshot> {
  return withTenantContext(actor.companyId, async tx => {
    const scope = { companyProfileId: actor.companyId };
    const reader = await tx.companyChatReader.findUnique({ where: { companyProfileId_actorKey: { ...scope, actorKey: actor.key } } });
    const latest = await tx.companyChatMessage.findFirst({ where: scope, orderBy: { seq: 'desc' }, select: { seq: true, authorKey: true } });
    // Bound both rows and count to the same observed head under READ COMMITTED.
    // A concurrent later arrival belongs to the next snapshot, never this read ack.
    const head = latest?.seq ?? BigInt(0);
    const rows = options.summary ? [] : await tx.companyChatMessage.findMany({ where: { ...scope, seq: { lte: head, ...(options.before !== undefined ? { lt: options.before } : {}) } }, orderBy: { seq: 'desc' }, take: CHAT_PAGE_SIZE + 1 });
    const unread = await tx.companyChatMessage.count({ where: { ...scope, seq: { gt: reader?.lastReadSeq ?? BigInt(0), lte: head }, authorKey: { not: actor.key } } });
    const page = rows.slice(0, CHAT_PAGE_SIZE).reverse();
    return { actor: { key: actor.key, name: actor.name, demo: actor.demo, ...(actor.context ? { context: actor.context } : {}) }, unread, latest: (latest?.seq ?? BigInt(0)).toString(), latestAuthor: latest?.authorKey ?? null,
      older: rows.length > CHAT_PAGE_SIZE ? page[0].seq.toString() : null,
      messages: page.map(row => ({ id: row.id, seq: row.seq.toString(), authorKey: row.authorKey, authorName: row.authorName, body: row.body, at: row.createdAt.toISOString() })) };
  });
}

export async function applyCompanyChatCommand(actor: ChatIdentity, command: ChatCommand) {
  if (actor.key !== command.actorKey) throw new ChatError('profile', 409);
  if (command.type === 'read') {
    const through = BigInt(command.through);
    if (through === BigInt(0)) return { created: false };
    await withTenantContext(actor.companyId, async tx => {
      const message = await tx.companyChatMessage.findFirst({ where: { companyProfileId: actor.companyId, seq: through }, select: { id: true } });
      if (!message) throw new ChatError('invalid');
      // Monotonic and snapshot-bound: a late request cannot erase a newer cursor,
      // and arrivals after the rendered snapshot remain unread.
      await tx.$executeRaw`INSERT INTO "CompanyChatReader" ("companyProfileId","actorKey","lastReadSeq","updatedAt") VALUES (${actor.companyId},${actor.key},${through},NOW()) ON CONFLICT ("companyProfileId","actorKey") DO UPDATE SET "lastReadSeq"=GREATEST("CompanyChatReader"."lastReadSeq",EXCLUDED."lastReadSeq"),"updatedAt"=NOW()`;
    });
    return { created: false };
  }
  const result = await withTenantContext(actor.companyId, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-chat:${actor.companyId}`}))`;
    const prior = await tx.companyChatMessage.findUnique({ where: { companyProfileId_authorKey_requestId: { companyProfileId: actor.companyId, authorKey: actor.key, requestId: command.requestId } } });
    if (prior) { if (prior.body !== command.body) throw new ChatError('retry', 409); return { id: prior.id, created: false }; }
    if (await tx.companyChatMessage.count({ where: { companyProfileId: actor.companyId } }) >= CHAT_HISTORY_LIMIT) throw new ChatError('storage', 413);
    const recent = { companyProfileId: actor.companyId, createdAt: { gte: new Date(Date.now() - 60_000) } };
    const personal = await tx.companyChatMessage.count({ where: { ...recent, authorKey: actor.key } });
    const company = await tx.companyChatMessage.count({ where: recent });
    if (personal >= 20 || company >= 120) throw new ChatError('rate', 429);
    const latest = await tx.companyChatMessage.findFirst({ where: { companyProfileId: actor.companyId }, orderBy: { seq: 'desc' }, select: { seq: true } });
    const message = await tx.companyChatMessage.create({ data: { companyProfileId: actor.companyId, seq: (latest?.seq ?? BigInt(0)) + BigInt(1), authorKey: actor.key, authorName: actor.name, requestId: command.requestId, body: command.body } });
    return { id: message.id, created: true };
  });
  if (result.created) {
    notifyRealtimeUpdate('company-chat.updated', ['company-chat'], actor.companyId);
    // A committed message survives provider failure. Existing device consent and
    // preferences govern push; unread state never depends on provider delivery.
    try {
      const recipients = await withTenantContext(actor.companyId, async tx => {
        const admins = await tx.user.findMany({ where: { companyProfileId: actor.companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
        const workers = await tx.worker.findMany({ where: { companyProfileId: actor.companyId, status: 'active' }, select: { id: true } });
        return [...admins, ...workers].map(row => row.id).filter(id => id !== actor.notificationUserId);
      });
      await sendNotification({ userIds: recipients, title: actor.name, body: '💬 Company chat · Firmenchat', url: `${actor.demo ? '/demo' : ''}/workzone?teamChat=1`, preference: 'adminMessages' });
    } catch { /* In-app unread history remains the durable notification. */ }
  }
  return result;
}

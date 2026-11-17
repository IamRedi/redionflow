import { describe, expect, it } from 'vitest';
import { chatCommand, chatSequence, readChatCommand } from './contract';

const send = { type: 'send', actorKey: 'worker:test', requestId: '5f84ae42-ef29-4cd4-878f-de190c481220', body: 'Hello team' };
describe('company chat input boundaries', () => {
  it('accepts ordinary multiline text and rejects client-supplied authors/tenants', () => {
    expect(chatCommand.parse({ ...send, body: '  One\nTwo  ' })).toMatchObject({ body: 'One\nTwo' });
    for (const extra of [{ authorName: 'Boss' }, { companyId: 'another' }, { authorKey: 'admin:owner' }]) expect(chatCommand.safeParse({ ...send, ...extra }).success).toBe(false);
  });
  it('rejects empty, oversized and control-character messages and invalid command ids', () => {
    for (const body of ['', '  ', 'a'.repeat(1501), 'bad\u0000text']) expect(chatCommand.safeParse({ ...send, body }).success).toBe(false);
    expect(chatCommand.safeParse({ ...send, requestId: 'reused-not-a-uuid' }).success).toBe(false);
  });
  it('bounds cursor shape and signed PostgreSQL range', () => {
    for (const value of ['-1', '01', '1e3', '9223372036854775808', '9'.repeat(100)]) expect(chatSequence.safeParse(value).success).toBe(false);
    expect(chatSequence.parse('9223372036854775807')).toBe('9223372036854775807');
  });
  it('rejects oversized chunked bodies without relying on content-length', async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('a'.repeat(9000))); controller.close(); } });
    const request = new Request('http://localhost/api/company-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' } as RequestInit);
    await expect(readChatCommand(request)).rejects.toMatchObject({ status: 413 });
  });
  it('requires JSON and rejects malformed payloads', async () => {
    await expect(readChatCommand(new Request('http://localhost', { method: 'POST', body: JSON.stringify(send) }))).rejects.toMatchObject({ status: 415 });
    await expect(readChatCommand(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' }))).rejects.toMatchObject({ status: 400 });
  });
});

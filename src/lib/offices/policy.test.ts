import { describe, expect, it } from 'vitest';
import { officeSeat } from './policy';

const config = { companyId: 'company-one', megi: { adminId: 'admin-megi', workerId: 'worker-megi' }, almet: { adminId: 'admin-almet' } };
const raw = JSON.stringify(config);
describe('first office release authorization', () => {
  it('accepts only explicitly configured identities of the two people', () => {
    expect(officeSeat(raw, { kind:'admin', id:'admin-megi', companyId:'company-one' })).toBe('megi');
    expect(officeSeat(raw, { kind:'admin', id:'admin-almet', companyId:'company-one' })).toBe('almet');
    expect(officeSeat(raw, { kind:'worker', id:'worker-megi', companyId:'company-one' })).toBe('megi');
  });
  it('rejects names, other admins, other tenants, wrong identity kinds and anonymous users', () => {
    for (const id of ['Megi','Almet','other-admin','worker-megi']) expect(officeSeat(raw, { kind:'admin', id, companyId:'company-one' })).toBeNull();
    expect(officeSeat(raw, { kind:'admin', id:'admin-megi', companyId:'company-two' })).toBeNull();
    expect(officeSeat(raw, { kind:'worker', id:'admin-megi', companyId:'company-one' })).toBeNull();
    expect(officeSeat(raw, null)).toBeNull();
  });
  it('fails closed when disabled, malformed, incomplete or ambiguous', () => {
    const actor = { kind:'admin' as const, id:'admin-megi', companyId:'company-one' };
    for (const value of [undefined,'','{}','bad-json',JSON.stringify({...config,almet:config.megi}),JSON.stringify({...config,extra:true}),JSON.stringify({...config,megi:{adminId:''}})]) expect(officeSeat(value,actor)).toBeNull();
  });
});

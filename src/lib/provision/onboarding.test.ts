import { describe, expect, it } from 'vitest';
import { blueprintModules, factoryEnabled, readBlueprint, resolveBlueprint } from './blueprints';
import { planCompanySetup, setupSummary } from './onboarding';
import { can, type AccessSubject } from '@/lib/access/rules';
import { doneQty, onFieldList, readProcessRoutes, stageRemaining } from '@/lib/elements/stages';
import { factoryOutput } from '@/lib/elements/factory-output';
import { isFactoryDefinition } from './factory-policy';

const input = () => ({ key: 'example-steel', blueprint: { id: 'steel-assembly', version: 1 }, company: {
  displayName: 'Example GmbH', legalName: 'Example GmbH', mode: 'bau', country: 'DE',
  owner: { name: 'Synthetic Owner', email: 'Synthetic@Example.test' },
} });
describe('clean versioned company setup', () => {
  it('pins provenance, defaults and capabilities without client-specific identity', () => {
    const plan = planCompanySetup(input());
    expect(plan.profile).toMatchObject({ id: 'steel-assembly', version: 1, factory: false });
    expect(plan.modules.disabled).toEqual(['factory']);
    expect(plan.input.company.sites).toEqual([]);
    expect(plan.input.company.knowledge).toEqual([]);
    expect(JSON.stringify(plan.profile)).not.toMatch(/example|owner|al steel|muster/i);
    expect(blueprintModules(resolveBlueprint({ id: 'steel-fabrication', version: 1 })).enabled).toContain('factory');
  });
  it('binds review to normalized company data and explicit overrides', () => {
    const original = planCompanySetup(input());
    expect(planCompanySetup({ ...input(), company: { ...input().company, owner: { name: 'Synthetic Owner', email: 'synthetic@example.test' } } }).digest).toBe(original.digest);
    expect(planCompanySetup({ ...input(), blueprint: { id: 'steel-assembly', version: 1, factory: true } }).digest).not.toBe(original.digest);
    expect(planCompanySetup({ ...input(), company: { ...input().company, displayName: 'Changed company' } }).digest).not.toBe(original.digest);
    expect(JSON.stringify(setupSummary(original))).not.toMatch(/synthetic@example|Synthetic Owner|Example GmbH/);
  });
  it('rejects incompatible versions, modes, clones, duplicate records and a disabled factory site', () => {
    expect(() => planCompanySetup({ ...input(), sourceCompanyId: 'real-client' })).toThrow();
    expect(() => planCompanySetup({ ...input(), blueprint: { id: 'steel-assembly', version: 2 } })).toThrow();
    expect(() => planCompanySetup({ ...input(), company: { ...input().company, mode: 'baumdienst' } })).toThrow('BLUEPRINT_MODE_MISMATCH');
    expect(() => planCompanySetup({ ...input(), company: { ...input().company, sites: [{ name: 'Factory', type: 'STEEL_WORKSHOP' }] } })).toThrow('FACTORY_SITE_DISABLED');
    expect(() => planCompanySetup({ ...input(), company: { ...input().company, sites: [{ name: 'Site A', type: 'STEEL_ASSEMBLY' }, { name: 'site a', type: 'STEEL_ASSEMBLY' }] } })).toThrow('DUPLICATE_SITE');
  });
  it('preserves unconfigured legacy tenants and fails closed on malformed snapshots', () => {
    expect(factoryEnabled(null)).toBe(true);
    expect(readBlueprint(null)).toBeNull();
    for (const value of [{}, { ...resolveBlueprint({ id: 'steel-assembly', version: 1 }), version: 999 }, { factory: false }]) expect(() => factoryEnabled(value)).toThrow();
  });
  it('does not let an owner, crew role or explicit grant reopen a disabled company module', () => {
    const admin: AccessSubject = { kind: 'admin', factoryEnabled: false };
    const worker: AccessSubject = { kind: 'worker', active: true, accessLevel: 'FULL_VIEW', crewRole: 'FACTORY_ENGINEER', factoryEnabled: false, grants: [{ place: 'factory', scopeId: '', level: 'act' }] };
    for (const subject of [admin, worker]) {
      expect(can(subject, 'factory.view', 'site-a')).toBe(false);
      expect(can(subject, 'factory.steps', 'site-a')).toBe(false);
      expect(can(subject, 'field.view', 'site-a')).toBe(true);
    }
    expect(can({ kind: 'admin' }, 'factory.steps')).toBe(true);
  });
  it('recognizes production site tasks and linked factory work as part of the module', () => {
    expect(isFactoryDefinition({ kind: 'site', key: 'steel-drilling' })).toBe(true);
    expect(isFactoryDefinition({ kind: 'site', phaseGroup: 'production', label: 'Prerje' })).toBe(true);
    expect(isFactoryDefinition({ kind: 'site', linkedProcessKey: 'welding' })).toBe(true);
    expect(isFactoryDefinition({ kind: 'site', key: 'steel-foundation' })).toBe(false);
  });
  it('makes externally supplied assemblies available for receiving without fake factory events', () => {
    const routes = { v: 1, factory: [], field: ['received', 'mounted'], supply: 'external' };
    const element = { list: 'assembly' as const, quantity: 4, processRoutes: routes, work: [] };
    expect(readProcessRoutes(routes)).toEqual(routes);
    expect(onFieldList(element)).toBe(true);
    expect(stageRemaining(element, 'received')).toBe(4);
    expect(doneQty(element, 'field')).toBe(0);
    expect(onFieldList({ ...element, processRoutes: { v: 1, factory: [], field: ['received'] } })).toBe(false);
    expect(readProcessRoutes({ ...routes, factory: ['cutting'] })).toBeNull();
    expect(factoryOutput([{ ...element, baustelleId: 'site-a', weightKg: 10, factoryDoneAt: null, fieldDoneAt: null }], [{ id: 'site-a', name: 'Synthetic' }])).toEqual([]);
  });
});

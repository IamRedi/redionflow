import {afterEach,describe,expect,it,vi} from 'vitest';
import {craneMusterPublicDemoConfigured,publicMusterProfile,publicMusterSubject} from './public-muster';
const env={APP_ENV:'demo',SAAS_MODE:'false',DEMO_MODE:'true',CRANE_MUSTER_PUBLIC_DEMO:'true',INSTALLATION_COMPANY_ID:'company-rheinruhr-kran-muster',CRANE_MUSTER_OWNER_ID:'synthetic-crane-owner'};
afterEach(()=>vi.unstubAllEnvs());
describe('separate crane public demo',()=>{
 it('requires every explicit installation gate and its own owner ID',()=>{
  expect(craneMusterPublicDemoConfigured(env)).toBe(true);
  for(const key of Object.keys(env))expect(craneMusterPublicDemoConfigured({...env,[key]:undefined})).toBe(false);
  for(const APP_ENV of ['production','saas','test'])expect(craneMusterPublicDemoConfigured({...env,APP_ENV})).toBe(false);
  for(const INSTALLATION_COMPANY_ID of ['al-steel','bauflow-muster-steel','baumdienst'])expect(publicMusterProfile({...env,INSTALLATION_COMPANY_ID})).toBeNull();
 });
 it('has no factory role and accepts no arbitrary account or prototype key',()=>{
  expect(publicMusterSubject('owner',env)?.id).toBe('synthetic-crane-owner');
  expect(publicMusterSubject('disposition',env)?.id).toBe('crane-muster-dispo');
  expect(publicMusterSubject('office',env)?.id).toBe('crane-muster-finance');
  for(const role of ['factory','__proto__','constructor','al-steel','synthetic-crane-owner'])expect(publicMusterSubject(role,env)).toBeNull();
 });
 it('preserves the original Muster opt-in and fixed identity',()=>{
  const old={APP_ENV:'demo',SAAS_MODE:'false',DEMO_MODE:'true',BAUFLOW_MUSTER_PROFILE:'steel-v1',BAUFLOW_MUSTER_PUBLIC_DEMO:'true',INSTALLATION_COMPANY_ID:'bauflow-muster-steel'};
  expect(publicMusterProfile(old)?.crane).toBe(false);
  expect(publicMusterSubject('owner',old)?.id).toBe('bauflow-muster-chief');
  expect(publicMusterSubject('factory',old)?.id).toBe('bauflow-muster-factory-a');
 });
});

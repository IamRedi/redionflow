import { describe,expect,it } from 'vitest';
import { readCompanyUiIdentity,companyUiSiteLabel } from './ui-identity';
import { planCompanySetup } from './onboarding';

const input={key:'fictional-crane',blueprint:{id:'steel-assembly',version:1},company:{displayName:'Fictional Crane',legalName:'Fictional Crane Company',mode:'bau',country:'DE',owner:{name:'Fictional Owner',email:'owner@example.test'}}};
describe('company-owned visual identity',()=>{
  it('keeps existing firms on their original appearance',()=>{
    expect(readCompanyUiIdentity(null)).toBeNull();
    expect(readCompanyUiIdentity(undefined)).toBeNull();
    expect(planCompanySetup(input).input.company.uiIdentity).toBeUndefined();
  });
  it('binds the reviewed visual choice without changing the frozen business profile',()=>{
    const a=planCompanySetup(input),b=planCompanySetup({...input,company:{...input.company,uiIdentity:'crane-red-blue-v1'}});
    expect(a.profile).toEqual(b.profile);
    expect(a.digest).not.toBe(b.digest);
    expect(b.profile.factory).toBe(false);
    expect(readCompanyUiIdentity(b.input.company.uiIdentity)).toBe('crane-red-blue-v1');
  });
  it('rejects unreviewed CSS, remote media and unknown visual profiles',()=>{
    for(const uiIdentity of ['steel-v1','url(https://example.test/track)','<style>body{}</style>',{}]){
      expect(()=>readCompanyUiIdentity(uiIdentity)).toThrow();
      expect(()=>planCompanySetup({...input,company:{...input.company,uiIdentity}})).toThrow();
    }
  });
  it('keeps display vocabulary separate from the frozen module choices',()=>{
    expect(companyUiSiteLabel(null,'de')).toBeNull();
    expect(companyUiSiteLabel('crane-red-blue-v1','de-DE')).toBe('Hebeeinsatz');
    expect(companyUiSiteLabel('crane-red-blue-v1','en')).toBe('Lifting job');
    expect(planCompanySetup(input).profile.factory).toBe(false);
  });
});

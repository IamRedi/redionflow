import { BAUFLOW_MUSTER_COMPANY_ID, bauflowDemoSubject, bauflowMusterPublicDemoConfigured } from './bauflow-muster';

type DemoEnv = Readonly<Record<string,string|undefined>>;
export const CRANE_DEMO_COMPANY_ID = 'company-rheinruhr-kran-muster';
export function craneMusterPublicDemoConfigured(env:DemoEnv=process.env) {
  return ['demo','local'].includes(env.APP_ENV??'') && env.SAAS_MODE==='false'
    && env.DEMO_MODE==='true' && env.CRANE_MUSTER_PUBLIC_DEMO==='true'
    && env.INSTALLATION_COMPANY_ID===CRANE_DEMO_COMPANY_ID
    && /^[a-zA-Z0-9_-]{8,128}$/.test(env.CRANE_MUSTER_OWNER_ID??'');
}
export function publicMusterProfile(env:DemoEnv=process.env) {
  if(craneMusterPublicDemoConfigured(env)) return {
    crane:true, companyId:CRANE_DEMO_COMPANY_ID,
    legalName:'RheinRuhr Kranservice Muster GmbH · Fiktive Demofirma',
    title:'RheinRuhr Kranservice · MUSTER',logo:'/company-studio/crane-red-blue-v1/logo.svg',
  };
  if(bauflowMusterPublicDemoConfigured(env))return {
    crane:false,companyId:BAUFLOW_MUSTER_COMPANY_ID,
    legalName:'BauFlow Musterbau GmbH · Fiktive Demofirma',
    title:'BauFlow · Musterfirma',logo:'/bauflow-muster-v1/brand-profile.webp',
  };
  return null;
}
export function publicMusterSubject(role:string,env:DemoEnv=process.env) {
  if(!craneMusterPublicDemoConfigured(env))return bauflowDemoSubject(role,env);
  const subjects={
    owner:{kind:'admin',id:env.CRANE_MUSTER_OWNER_ID!,role:'ADMIN'},
    office:{kind:'worker',id:'crane-muster-finance',role:'OFFICE'},
    disposition:{kind:'worker',id:'crane-muster-dispo',role:'OFFICE'},
    field:{kind:'worker',id:'crane-muster-operator-a',role:'FIELD_WORKER'},
    workshop:{kind:'worker',id:'crane-muster-mechanic',role:'MECHANIC'},
  } as const;
  return Object.hasOwn(subjects,role)?subjects[role as keyof typeof subjects]:null;
}

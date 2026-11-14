/** Explicit installation + authenticated tenant lock. No name/first-tenant inference. */
export const BAUFLOW_MUSTER_COMPANY_ID = 'bauflow-muster-steel';
export const BAUFLOW_MUSTER_OWNER_ID = 'bauflow-muster-chief';
export const BAUFLOW_MUSTER_PROFILE = 'steel-v1';

type MusterEnv = Readonly<Record<string, string | undefined>>;

export function bauflowMusterConfigured(env: MusterEnv = process.env) {
  return ['local', 'demo'].includes(env.APP_ENV?.trim().toLowerCase() ?? '')
    && !['true', '1', 'yes'].includes(env.SAAS_MODE?.trim().toLowerCase() ?? '')
    && env.BAUFLOW_MUSTER_PROFILE === BAUFLOW_MUSTER_PROFILE
    && env.INSTALLATION_COMPANY_ID === BAUFLOW_MUSTER_COMPANY_ID;
}

export function isBauflowMusterCompany(companyId: string | null, env: MusterEnv = process.env) {
  return companyId === BAUFLOW_MUSTER_COMPANY_ID && bauflowMusterConfigured(env);
}

/** Public role entry is a separate, explicit opt-in for this synthetic demo. */
export function bauflowMusterPublicDemoConfigured(env: MusterEnv = process.env) {
  return bauflowMusterConfigured(env)
    && env.DEMO_MODE === 'true'
    && env.BAUFLOW_MUSTER_PUBLIC_DEMO === 'true';
}

const demoSubjects = {
  owner: { kind: 'admin', id: BAUFLOW_MUSTER_OWNER_ID, role: 'ADMIN' },
  office: { kind: 'worker', id: 'bauflow-muster-finance', role: 'OFFICE' },
  field: { kind: 'worker', id: 'bauflow-muster-site-a', role: 'FIELD_WORKER' },
  factory: { kind: 'worker', id: 'bauflow-muster-factory-a', role: 'FACTORY_WORKER' },
  workshop: { kind: 'worker', id: 'bauflow-muster-mechanic', role: 'MECHANIC' },
} as const;

export type BauflowDemoRole = keyof typeof demoSubjects;

export function bauflowDemoSubject(role: string, env: MusterEnv = process.env) {
  if (!bauflowMusterPublicDemoConfigured(env) || !Object.hasOwn(demoSubjects, role)) return null;
  return demoSubjects[role as BauflowDemoRole];
}

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

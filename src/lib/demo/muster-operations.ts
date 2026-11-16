import { isBauflowMusterCompany } from './bauflow-muster';

type Environment = Readonly<Record<string, string | undefined>>;

/** Presentation opt-in for the two fictional installations, never a permission. */
export function isMusterOperationsCompany(companyId: string | null, env: Environment = process.env) {
  if (isBauflowMusterCompany(companyId, env)) return true;
  return companyId === 'company-rheinruhr-kran-muster'
    && env.INSTALLATION_COMPANY_ID === companyId
    && ['local', 'demo'].includes(env.APP_ENV ?? '')
    && env.SAAS_MODE === 'false'
    && env.DEMO_MODE === 'true'
    && env.CRANE_MUSTER_PUBLIC_DEMO === 'true';
}

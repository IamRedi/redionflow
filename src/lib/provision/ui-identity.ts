import { z } from 'zod';

/** Reviewed reusable artwork/tokens only: never CSS, URLs or an inferred customer name. */
export const companyUiIdentitySchema = z.literal('crane-red-blue-v1');
export type CompanyUiIdentity = z.infer<typeof companyUiIdentitySchema>;
export function readCompanyUiIdentity(value: unknown): CompanyUiIdentity | null {
  if (value === null || value === undefined) return null;
  return companyUiIdentitySchema.parse(value);
}

/** Presentation vocabulary only; never used to select modules or authorize work. */
export function companyUiSiteLabel(identity: CompanyUiIdentity | null, language: string): string | null {
  if (identity !== 'crane-red-blue-v1') return null;
  const labels: Record<string,string> = { de:'Hebeeinsatz',en:'Lifting job',sq:'Punë me vinç',it:'Intervento gru',pl:'Praca dźwigu',ro:'Lucrare cu macara' };
  return labels[language.toLowerCase().split('-')[0]] ?? labels.de;
}

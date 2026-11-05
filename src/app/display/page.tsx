import { redirect } from "next/navigation";
import { isSteelCompany, productionAudience } from '@/lib/dashboard/steel-access';

export default async function DisplayIndexPage() {
  const audience = await productionAudience(true);
  if (audience && audience.company.mode === 'bau' && await isSteelCompany(audience.company.id)) redirect('/display/dashboard');
  redirect("/display/workzone");
}

import { notFound } from "next/navigation";
import { requireWorkshopDemo, ensureWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";
import { workshopSchema } from "@/lib/workshop/demo-model";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { workshopCopy } from "@/lib/workshop/copy";
import { PrintAssetLabel } from "@/components/demo/workshop/print-asset-label";

export default async function PrintPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  try { await requireWorkshopDemo(); } catch (e) { if (e instanceof SharedWorkshopError && e.status === 404) notFound(); throw e; } const { asset: id } = await searchParams;
  const state = workshopSchema.parse((await ensureWorkshopDemo()).data), asset = state.assets.find(a => a.id === id);
  if (!asset) notFound();
  return <PrintAssetLabel name={asset.name} code={asset.code} serial={asset.details?.serial} label={workshopCopy(await resolveRequestLanguage()).print} />;
}

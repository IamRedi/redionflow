import type { Prisma } from "@/generated/prisma/client";

type FileRef = { id: string; baustelleId: string; kind: string; fileName: string; reference: string | null };

/**
 * Everything that was read from one site document goes with it:
 * - a drawing-office list (Excel, kind "document"): the elements it wrote on
 *   the factory and field lists, with their checked work, unless another file
 *   of the same name is still on the site;
 * - a supplier order (kind "order"): the material it put on the factory line,
 *   with its history (older imports without a link: same site + order number).
 */
export async function removeSiteFileData(tx: Prisma.TransactionClient, companyId: string, file: FileRef) {
  let elements = 0, batches = 0;
  if (file.kind === "document") {
    const twin = await tx.siteFile.count({ where: { companyProfileId: companyId, baustelleId: file.baustelleId, fileName: file.fileName, id: { not: file.id } } });
    if (!twin) elements = (await tx.siteElement.deleteMany({ where: { companyProfileId: companyId, baustelleId: file.baustelleId, sourceFile: file.fileName } })).count;
  }
  if (file.kind === "order") {
    const legacy = file.reference
      ? [{ siteFileId: null, orderRef: file.reference }]
      : [];
    const twin = file.reference ? await tx.siteFile.count({ where: { companyProfileId: companyId, baustelleId: file.baustelleId, kind: "order", reference: file.reference, id: { not: file.id } } }) : 0;
    batches = (await tx.productionBatch.deleteMany({
      where: { companyProfileId: companyId, baustelleId: file.baustelleId, OR: [{ siteFileId: file.id }, ...(twin ? [] : legacy)] },
    })).count;
  }
  return { elements, batches };
}

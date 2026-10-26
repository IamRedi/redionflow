import { requireAdminTenant } from "@/lib/auth/authorization";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/prisma-types";
import { t } from "@/lib/i18n";

export default async function TemplateEditPage({ params }: { params: Promise<{ templateId: string }> }) {
  const companyProfileId = await requireAdminTenant();
  const { templateId } = await params;
  const template = await prisma.calculationTemplate.findFirst({
    where: { id: templateId, companyProfileId },
    include: { templatePositions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) notFound();

  async function saveMeta(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    await prisma.calculationTemplate.updateMany({
      where: { id, companyProfileId: actionCompanyId },
      data: { name, description },
    });
    revalidatePath(`/app/templates/${id}`);
    revalidatePath("/app/templates");
  }

  async function addPreset(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const tid = String(formData.get("templateId") ?? "");
    const owned = await prisma.calculationTemplate.findFirst({ where: { id: tid, companyProfileId: actionCompanyId }, select: { id: true } });
    if (!owned) notFound();
    const count = await prisma.templatePositionPreset.count({ where: { templateId: tid } });
    await prisma.templatePositionPreset.create({
      data: {
        templateId: tid,
        sortOrder: (count + 1) * 10,
        title: `Position ${count + 1}`,
        quantity: "1",
        unit: "pauschal",
      },
    });
    revalidatePath(`/app/templates/${tid}`);
    revalidatePath("/app/templates");
  }

  async function updatePreset(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const id = String(formData.get("id") ?? "");
    const tid = String(formData.get("templateId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const quantity = String(formData.get("quantity") ?? "1");
    const unit = String(formData.get("unit") ?? "pauschal").trim();
    await prisma.templatePositionPreset.updateMany({
      where: { id, templateId: tid, template: { companyProfileId: actionCompanyId } },
      data: { title, description, quantity, unit },
    });
    revalidatePath(`/app/templates/${tid}`);
  }

  async function deletePreset(formData: FormData) {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    const id = String(formData.get("id") ?? "");
    const tid = String(formData.get("templateId") ?? "");
    await prisma.templatePositionPreset.deleteMany({ where: { id, templateId: tid, template: { companyProfileId: actionCompanyId } } });
    revalidatePath(`/app/templates/${tid}`);
  }

  async function deleteTemplate() {
    "use server";
    const actionCompanyId = await requireAdminTenant();
    await prisma.calculationTemplate.deleteMany({ where: { id: templateId, companyProfileId: actionCompanyId } });
    revalidatePath("/app/templates");
    redirect("/app/templates");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("form.editTemplate")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{template.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.masterData")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveMeta} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={template.id} />
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="name">{t("form.name")}</Label>
              <Input id="name" name="name" defaultValue={template.name} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">{t("form.description")}</Label>
              <Textarea id="description" name="description" defaultValue={template.description ?? ""} rows={3} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{t("form.positionPresets")}</CardTitle>
            <CardDescription>{t("form.positionPresetsDescription")}</CardDescription>
          </div>
          <form action={addPreset}>
            <input type="hidden" name="templateId" value={template.id} />
            <Button type="submit" variant="outline" size="sm">
              {t("form.addPreset")}
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.title")}</TableHead>
                <TableHead className="text-right">{t("form.quantity")}</TableHead>
                <TableHead>{t("form.unit")}</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {template.templatePositions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell colSpan={4}>
                    <form action={updatePreset} className="grid gap-2 md:grid-cols-6">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="templateId" value={template.id} />
                      <Input name="title" className="md:col-span-2" defaultValue={p.title} />
                      <Input
                        name="description"
                        className="md:col-span-2"
                        defaultValue={p.description ?? ""}
                        placeholder={t("form.description")}
                      />
                      <Input name="quantity" defaultValue={decimalToNumber(p.quantity as never)} />
                      <Input name="unit" defaultValue={p.unit} />
                      <div className="md:col-span-6 flex justify-end gap-2">
                        <Button size="sm" type="submit" variant="secondary">
                          {t("common.save")}
                        </Button>
                      </div>
                    </form>
                    <form action={deletePreset} className="mt-2 flex justify-end">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="templateId" value={template.id} />
                      <Button size="sm" variant="destructive" type="submit">
                        {t("form.deletePreset")}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.dangerZone")}</CardTitle>
          <CardDescription>{t("form.deleteTemplate")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteTemplate}>
            <Button type="submit" variant="destructive">
              {t("form.deleteTemplate")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button asChild variant="outline">
          <Link href="/app/templates">{t("form.backToTemplates")}</Link>
        </Button>
      </div>
    </div>
  );
}


import { requireAdminTenant } from "@/lib/auth/authorization";
import Link from "next/link";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { t as translate } from "@/lib/i18n";

export default async function TemplatesPage() {
  const company = await getOrCreateDefaultCompany();
  const templates = await prisma.calculationTemplate.findMany({
    where: { companyProfileId: company.id },
    orderBy: { updatedAt: "desc" },
    include: { templatePositions: { orderBy: { sortOrder: "asc" } } },
  });

  async function createTemplate(formData: FormData) {
    "use server";
    const companyProfileId = await requireAdminTenant();
    const companyId = String(formData.get("companyId") ?? "");
    if (companyId !== companyProfileId) return;
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    if (!name) return;

    await prisma.calculationTemplate.create({
      data: {
        companyProfileId,
        name,
        description,
        templatePositions: {
          create: [
            { sortOrder: 10, title: "Standardposition 1", quantity: "1", unit: "pauschal" },
            { sortOrder: 20, title: "Standardposition 2", quantity: "1", unit: "pauschal" },
          ],
        },
      },
    });
    revalidatePath("/app/templates");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{translate("form.templates")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {translate("form.templatesDescription")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translate("form.newTemplate")}</CardTitle>
          <CardDescription>{translate("form.templatesNewDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTemplate} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="companyId" value={company.id} />
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="name">{translate("form.name")}</Label>
              <Input id="name" name="name" placeholder={translate("form.titleExample")} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">{translate("form.description")}</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">{translate("form.create")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate("form.templates")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("form.name")}</TableHead>
                <TableHead>{translate("form.positions")}</TableHead>
                <TableHead className="text-right">{translate("form.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.templatePositions.length}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/templates/${t.id}`}>{translate("common.edit")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{translate("form.noTemplates")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


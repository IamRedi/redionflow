"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { EXTERNAL_SERVICE_PRESETS, externalServiceTitle } from "@/lib/external-services/catalog";
import { machineOptionLabel, machineSearchText, type MachineCategoryCode, type MachineListOption } from "@/lib/machines/display";
import { MATERIAL_PRESETS, materialPresetTitle } from "@/lib/materials/catalog";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { normalizeLanguage } from "@/lib/i18n/language";
import { RECIPE_TEMPLATES, recipeTemplateText, type RecipeId } from "@/lib/recipes/catalog";

type LaborRoleOption = { id: string; name: string };

function decimalValue(value: FormDataEntryValue | null, fallback: number) {
  const text = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(text || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cents(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function rounded(value: number) {
  return Math.max(0.25, Math.round(value * 4) / 4).toString();
}

function findRole(roles: LaborRoleOption[], pattern: RegExp, fallbackIndex = 0) {
  return roles.find((role) => pattern.test(role.name)) ?? roles[fallbackIndex] ?? roles[0] ?? null;
}

function findMachine(machines: MachineListOption[], category: MachineCategoryCode, pattern: RegExp) {
  return machines.find((machine) => machine.category === category && pattern.test(machineSearchText(machine)))
    ?? machines.find((machine) => machine.category === category)
    ?? machines.find((machine) => pattern.test(machineSearchText(machine)))
    ?? null;
}

function material(title: string, quantity = "1", unit?: string, unitPriceEur?: string, lang?: string) {
  const preset = MATERIAL_PRESETS.find((item) => item.title === title);
  return {
    title: materialPresetTitle(title, lang),
    quantity,
    unit: unit ?? preset?.unit ?? "pauschal",
    unitPriceCents: cents(unitPriceEur ?? preset?.unitPriceEur ?? "0"),
  };
}

function external(title: string, multiplier = 1, amountEur?: string, lang?: string) {
  const preset = EXTERNAL_SERVICE_PRESETS.find((item) => item.title === title);
  return {
    title: externalServiceTitle(title, lang),
    amountCents: Math.round(cents(amountEur ?? preset?.amountEur ?? "0") * multiplier),
  };
}

export async function createRecipePositionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const recipeId = String(formData.get("recipeId") ?? "") as RecipeId;
  const recipe = RECIPE_TEMPLATES.find((item) => item.id === recipeId);
  if (!projectId || !recipe) return;
  const lang = normalizeLanguage(String(formData.get("lang") ?? "")) ?? "de";
  const recipeText = recipeTemplateText(recipe, lang);

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyProfileId: true } });
  if (!project || project.companyProfileId !== currentCompanyId) return;

  const amount = decimalValue(formData.get("amount"), Number(recipe.defaultAmount));
  const teamSize = Math.max(1, Math.round(decimalValue(formData.get("teamSize"), 2)));
  const access = String(formData.get("access") ?? "normal");
  const disposal = formData.get("disposal") === "on";
  const riskFactor = access === "hard" ? 1.35 : access === "easy" ? 0.85 : 1;

  const [roles, machines, sortOrder] = await Promise.all([
    prisma.laborRole.findMany({
      where: { companyProfileId: project.companyProfileId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.machine.findMany({
      where: { companyProfileId: project.companyProfileId, isActive: true },
      orderBy: [{ category: "asc" }, { nickname: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, nickname: true, model: true, targe: true, funksioni: true },
    }),
    prisma.projectPosition.count({ where: { projectId } }),
  ]);

  const skilled = findRole(roles, /fach|meister|kletter|baum|vorarbeiter/i, 0);
  const helper = findRole(roles, /helfer|arbeiter|gaertner|gärtner|worker/i, 1);
  const transporter = findMachine(machines, "TRUCK", /transporter|lkw|truck|fahrzeug|anhaenger|anhänger/);
  const chipper = findMachine(machines, "CHIPPER", /haecksler|häcksler|chipper|shredder/);
  const lift = findMachine(machines, "AWP", /hub|steiger|buehne|bühne|arbeitsbuehne|arbeitsbühne/);
  const mower = findMachine(machines, "OTHER", /rasen|maeher|mäher|pflege/);
  const excavator = findMachine(machines, "OTHER", /bagger|minibagger|erd/);

  const laborItems: Array<{ laborRoleId?: string; laborRoleNameSnapshot: string; workers: number; hours: string }> = [];
  const machineItems: Array<{ machineId: string; machineNameSnapshot: string; timeUnit: "HOURS" | "DAYS"; quantity: string }> = [];
  const materialItems: Array<{ title: string; quantity: string; unit: string; unitPriceCents: number }> = [];
  const externalServiceItems: Array<{ title: string; amountCents: number }> = [];

  function addLabor(role: LaborRoleOption | null, label: string, workers: number, hours: number) {
    if (!role) return;
    laborItems.push({ laborRoleId: role.id, laborRoleNameSnapshot: role.name || label, workers, hours: rounded(hours) });
  }

  function addMachine(machine: MachineListOption | null, quantity: number, timeUnit: "HOURS" | "DAYS" = "HOURS") {
    if (!machine) return;
    machineItems.push({ machineId: machine.id, machineNameSnapshot: machineOptionLabel(machine), timeUnit, quantity: rounded(quantity) });
  }

  switch (recipeId) {
    case "baumfaellung_standard":
      addLabor(skilled, "Fachkraft", 1, amount * 3.5 * riskFactor);
      addLabor(helper, "Helfer", Math.max(1, teamSize - 1), amount * 3 * riskFactor);
      addMachine(transporter, amount * 2.5 * riskFactor);
      if (disposal) addMachine(chipper, amount * 2 * riskFactor);
      if (disposal) materialItems.push(material("Gruenschnitt Entsorgung", amount.toString(), undefined, undefined, lang));
      if (access === "hard") externalServiceItems.push(external("Verkehrssicherung", 1, undefined, lang));
      break;
    case "baumpflege_kronenschnitt":
      addLabor(skilled, "Fachkraft", 1, amount * 1.6 * riskFactor);
      addLabor(helper, "Helfer", Math.max(1, teamSize - 1), amount * 1.2 * riskFactor);
      addMachine(lift ?? transporter, amount * 1.25 * riskFactor);
      if (disposal) addMachine(chipper, amount * 0.75 * riskFactor);
      if (disposal) materialItems.push(material("Gruenschnitt Entsorgung", Math.max(1, Math.ceil(amount / 5)).toString(), undefined, undefined, lang));
      break;
    case "stubbenfraesen":
      addLabor(skilled ?? helper, "Fachkraft", 1, amount * 1.1 * riskFactor);
      addMachine(excavator ?? transporter, amount * 1.25 * riskFactor);
      if (disposal) materialItems.push(material("Stubben / Fraesgut Entsorgung", amount.toString(), "Stk.", "45", lang));
      break;
    case "gartenpflege_tag":
      addLabor(helper ?? skilled, "Gartenpflege", Math.max(1, teamSize), amount * 7.5 * riskFactor);
      addMachine(transporter, amount * 4);
      addMachine(mower, amount * 5);
      if (disposal) materialItems.push(material("Gruenschnitt Entsorgung", amount.toString(), undefined, undefined, lang));
      break;
    case "hecke_schneiden":
      addLabor(skilled ?? helper, "Fachkraft", 1, amount * 0.08 * riskFactor);
      addLabor(helper, "Helfer", Math.max(0, teamSize - 1), amount * 0.06 * riskFactor);
      addMachine(transporter, Math.max(1, amount * 0.05));
      if (disposal) materialItems.push(material("Gruenschnitt Entsorgung", Math.max(1, Math.ceil(amount / 25)).toString(), undefined, undefined, lang));
      break;
    case "pflaster_vorbereiten":
      addLabor(skilled, "Fachkraft", 1, amount * 0.18 * riskFactor);
      addLabor(helper, "Helfer", Math.max(1, teamSize - 1), amount * 0.15 * riskFactor);
      addMachine(excavator ?? transporter, amount * 0.08 * riskFactor);
      materialItems.push(material("Schotter 0/32", rounded(amount * 0.18), undefined, undefined, lang));
      materialItems.push(material("Splitt 2/5", rounded(amount * 0.07), undefined, undefined, lang));
      if (disposal) externalServiceItems.push(external("Container Bauschutt", 1, undefined, lang));
      break;
    case "erdarbeiten_minibagger":
      addLabor(skilled ?? helper, "Fachkraft", 1, amount * 0.5 * riskFactor);
      addLabor(helper, "Helfer", Math.max(0, teamSize - 1), amount * 0.25 * riskFactor);
      addMachine(excavator, amount * 0.75 * riskFactor);
      addMachine(transporter, amount * 0.25 * riskFactor);
      if (disposal) externalServiceItems.push(external("Container Bauschutt", Math.max(1, amount / 8), undefined, lang));
      break;
    case "regie_2_mann_transporter":
      addLabor(skilled ?? helper, "Fachkraft", 1, amount * 8);
      addLabor(helper, "Helfer", 1, amount * 8);
      addMachine(transporter, amount * 8);
      break;
  }

  const position = await prisma.projectPosition.create({
    data: {
      projectId,
      sortOrder,
      title: recipeText.title,
      description: recipeText.description,
      quantity: amount.toString(),
      unit: recipeText.unit,
      laborItems: laborItems.length ? { create: laborItems } : undefined,
      machineItems: machineItems.length ? { create: machineItems } : undefined,
      materialItems: materialItems.length ? { create: materialItems } : undefined,
      externalServiceItems: externalServiceItems.length ? { create: externalServiceItems } : undefined,
    },
    select: { id: true },
  });

  revalidatePath(`/app/projects/${projectId}`);
  redirect(`/app/projects/${projectId}/positions/${position.id}`);
}

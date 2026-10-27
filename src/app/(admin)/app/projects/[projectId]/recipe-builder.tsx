import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { RECIPE_TEMPLATES, recipeTemplateText, type RecipeCategory } from "@/lib/recipes/catalog";
import { createRecipePositionAction } from "./recipe-builder-actions";

import type { CompanyMode } from "@/lib/mode-config";

// BauFlow companies only see construction recipes; tree and garden recipes
// stay in BaumdienstFlow.
const CATEGORIES_BY_MODE: Record<CompanyMode, RecipeCategory[]> = {
  baumdienst: ["baumdienst", "gartenbau", "bau", "regie"],
  bau: ["bau", "regie"],
};

export function RecipeBuilder({ projectId, currentLang, mode }: { projectId: string; currentLang: string; mode: CompanyMode }) {
  const categories = CATEGORIES_BY_MODE[mode] ?? CATEGORIES_BY_MODE.baumdienst;
  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const recipes = RECIPE_TEMPLATES.filter((recipe) => recipe.category === category);
        if (recipes.length === 0) return null;

        return (
          <section key={category} className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {t(`admin.recipeCategory.${category}`, currentLang)}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {recipes.map((recipe) => {
                const text = recipeTemplateText(recipe, currentLang);
                return (
                <form key={recipe.id} action={createRecipePositionAction} className="rounded-md border bg-muted/15 p-3">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="lang" value={currentLang} />
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="font-medium">{text.title}</div>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{text.description}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`${recipe.id}-amount`}>{text.amountLabel}</Label>
                        <Input id={`${recipe.id}-amount`} name="amount" inputMode="decimal" defaultValue={recipe.defaultAmount} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${recipe.id}-team`}>{t("admin.recipeTeam", currentLang)}</Label>
                        <Input id={`${recipe.id}-team`} name="teamSize" inputMode="numeric" defaultValue="2" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`${recipe.id}-access`}>{t("admin.recipeAccessRisk", currentLang)}</Label>
                        <select id={`${recipe.id}-access`} name="access" defaultValue="normal" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                          <option value="easy">{t("admin.recipeAccessEasy", currentLang)}</option>
                          <option value="normal">{t("admin.recipeAccessNormal", currentLang)}</option>
                          <option value="hard">{t("admin.recipeAccessHard", currentLang)}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input name="disposal" type="checkbox" defaultChecked />
                        {t("admin.recipePlanDisposal", currentLang)}
                      </label>
                      <Button type="submit">{t("admin.recipeCreate", currentLang)}</Button>
                    </div>
                  </div>
                </form>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

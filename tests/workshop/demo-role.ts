import { expect,type Page } from "@playwright/test";
export async function switchDemoRole(page:Page,key:string){
  const previous=page.url();
  await page.goto('/demo/control');
  const selector=page.getByTestId('muster-profile-tools').getByRole('combobox',{name:'Demo ausprobieren als'});
  await expect(selector).toBeEnabled();await selector.selectOption(key);await expect(selector).toHaveValue(key);
  await page.goto(previous);
}

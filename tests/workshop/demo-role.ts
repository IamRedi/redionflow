import { expect,type Page } from "@playwright/test";
export async function switchDemoRole(page:Page,key:string){
  const more=page.getByLabel("Mehr",{exact:true}),selector=page.getByRole("combobox",{name:"Demo ausprobieren als"});
  if(!await selector.isVisible())await more.click();
  await selector.selectOption(key);await expect(selector).toHaveValue(key);
  await more.click();
}

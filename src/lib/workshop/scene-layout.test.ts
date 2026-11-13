import {describe,expect,it} from "vitest";
import {sceneLayout} from "./scene-layout";
describe("viewport Workzone pages",()=>{
  it.each([[1440,740],[366,690],[296,440],[820,230],[366,194]])("keeps unscaled cards and paging controls inside %d×%d",(w,h)=>{
    const m=sceneLayout(w,h,50);
    expect(m.capacity).toBeGreaterThan(0); expect(m.cardWidth).toBeGreaterThanOrEqual(128);
    expect(m.left).toBeGreaterThanOrEqual(12); expect(m.maxX+m.cardWidth).toBeLessThanOrEqual(w-11);
    expect(m.maxY+m.cardHeight).toBeLessThanOrEqual(h-47);
    expect(m.startY).toBeGreaterThanOrEqual(m.top);
    expect(m.rowGap).toBeGreaterThan(m.cardHeight); expect(m.columnGap).toBeGreaterThan(m.cardWidth);
  });
  it("centers a short page without inventing extra work or changing records",()=>{
    const a=sceneLayout(1440,740,1),b=sceneLayout(1440,740,3);
    expect(a.left).toBeGreaterThan(b.left);expect(sceneLayout(1440,740,0).capacity).toBeGreaterThan(0);
  });
});

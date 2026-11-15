import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { atlasCopy, atlasProfiles, resolveAtlas } from "./atlas";
import { botanicalReferences } from "./botanical";
import { atlasNote } from "./atlas-notes";
import { isStudioMediaId, studioMediaIds } from "./studio-media";

describe("Musterfirma field atlas",()=>{
  it("covers the studio catalogue and every species seeded in the three Baumdienst sites",()=>{
    const names=[...botanicalReferences.map(r=>r.name),"Winterlinde","Sommerlinde","Spitzahorn","Lärche","Fichte","Kiefer","Birke"];
    for(const name of names) expect(resolveAtlas(name),name).not.toBeNull();
    expect(resolveAtlas("Sommerlinde")?.profile.latin).toBe("Tilia platyphyllos");
    expect(resolveAtlas("Spitzahorn")?.profile.latin).toBe("Acer platanoides");
    expect(resolveAtlas("Hainbuchenhecke")?.profile.id).toBe("tree-hornbeam");
    expect(resolveAtlas("Eberesche")?.profile.id).toBe("tree-rowan");
  });
  it("ships bounded photoreal references for every catalogue species in all seasons",()=>{
    const manifest=JSON.parse(readFileSync("assets/baumdienst-studio/photoreal-v2/manifest.json","utf8")) as {assets:{id:string;cardBytes:number;largeBytes:number;alpha:boolean;latin:string}[]};
    expect(new Set(manifest.assets.map(a=>a.id))).toEqual(new Set(atlasProfiles.map(p=>p.id)));
    for(const asset of manifest.assets){expect(asset.alpha).toBe(true);expect(asset.cardBytes).toBeLessThan(150000);expect(readFileSync(`assets/baumdienst-studio/photoreal-v2/${asset.id}-card.webp`).length).toBe(asset.cardBytes);expect(readFileSync(`assets/baumdienst-studio/photoreal-v2/${asset.id}-large.webp`).length).toBe(asset.largeBytes);}
  });
  it("labels broad groups as examples and refuses unlisted or different exact species",()=>{
    expect(resolveAtlas("Linde")?.representative).toBe(true);
    expect(resolveAtlas("Winterlinde")?.representative).toBe(false);
    for(const name of ["Hecke","Kirschlorbeer","Acer palmatum","Quercus petraea","Salix caprea","Prunus avium","Unbekannt",""]) expect(resolveAtlas(name),name).toBeNull();
  });
  it("ships every referenced image and complete text in all six demo languages",()=>{
    const manifest=JSON.parse(readFileSync("assets/baumdienst-studio/v1/manifest.json","utf8")) as {assets:{id:string;bytes:number}[]};
    expect(new Set(manifest.assets.map(a=>a.id))).toEqual(new Set(studioMediaIds));
    for(const asset of manifest.assets){expect(isStudioMediaId(asset.id)).toBe(true);expect(readFileSync(`assets/baumdienst-studio/v1/${asset.id}.webp`).length).toBe(asset.bytes);}
    for(const lang of ["de","sq","en","it","pl","ro"]){
      expect(Object.values(atlasCopy(lang)).every(v=>v && !v.includes("|"))).toBe(true);
      for(const profile of atlasProfiles) expect(atlasNote(profile.id,lang),`${profile.id}/${lang}`).toBeTruthy();
    }
    expect(isStudioMediaId("../manifest")).toBe(false);
    expect(isStudioMediaId("__proto__")).toBe(false);
  });
});

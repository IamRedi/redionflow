import { describe, expect, it } from "vitest";
import { botanicalIdentity, botanicalPalette, botanicalReferences } from "./botanical";
describe("botanical name references",()=>{
  it.each([["Hainbuche","hornbeam"],["Eberesche","rowan"],["Picea abies","spruce"],["Abies alba","fir"],["Rosskastanie","chestnut"],["Platane","plane"],["Bergahorn","maple"],["Glanzmispelhecke","photinia"],["Thujahecke","thuja"]])("distinguishes %s",(name,kind)=>expect(botanicalIdentity(name).kind).toBe(kind));
  it("does not infer a species or leaf from Hecke or another ambiguous name",()=>{
    expect(botanicalIdentity("Hecke")).toMatchObject({known:false,hedge:true});
    expect(botanicalIdentity("Unbekannt").known).toBe(false);
    expect(botanicalIdentity("Kirschlorbeer").kind).not.toBe("privet");
    expect(botanicalIdentity("Kastanie").kind).not.toBe("chestnut");
  });
  it("keeps Rotbuche green in summer and distinguishes actual copper foliage",()=>{
    expect(botanicalIdentity("Rotbuche").copper).toBe(false);
    expect(botanicalPalette("Rotbuche")).not.toEqual(botanicalPalette("Blutbuche"));
    expect(botanicalPalette("Rotbuche","summer")).not.toEqual(botanicalPalette("Rotbuche","autumn"));
    expect(botanicalPalette("Thujahecke","summer")).toEqual(botanicalPalette("Thujahecke","autumn"));
    expect(botanicalPalette("Acer rubrum","autumn")).not.toEqual(botanicalPalette("Bergahorn","autumn"));
  });
  it("offers identifiable trees and hedges without mutating site records",()=>{
    expect(botanicalReferences.filter(r=>botanicalIdentity(r.name).hedge).length).toBeGreaterThanOrEqual(6);
    expect(botanicalReferences.every(r=>botanicalIdentity(r.name).known)).toBe(true);
  });
});

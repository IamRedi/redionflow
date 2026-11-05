import {describe,it,expect} from "vitest";
import {assetArtKind,treeArtKind,ILLUSTRATION_STYLE} from "./identity-art";
describe("Musterfirma illustration identity",()=>{
 it.each([["Eiche / Quercus robur","oak"],["Acer platanoides","maple"],["Birke","birch"],["Fagus sylvatica","beech"],["Fraxinus excelsior","ash"],["Tilia cordata","lime"],["Picea abies","conifer"],["Salix alba","willow"],["Malus domestica","fruit"],["Unbekannt","broadleaf"]])("matches species %s",(name,kind)=>expect(treeArtKind(name)).toBe(kind));
 it.each([["Akku-Kettensäge","saw"],["Stangensäge","pole-saw"],["Laubbläser","blower"],["Freischneider","trimmer"],["Schaufel","spade"],["Schutzhelm","helmet"],["Unbekannte Ausrüstung","toolbox"]])("matches registered equipment %s",(name,kind)=>expect(assetArtKind("new-id",name)).toBe(kind));
 it("retains seeded art and uses the documented shared style",()=>{expect(assetArtKind("crane","new name")).toBe("crane");expect(assetArtKind("new","unknown","vehicle")).toBe("truck");expect(ILLUSTRATION_STYLE).toBe("baumdienst-forest-v1");});
});

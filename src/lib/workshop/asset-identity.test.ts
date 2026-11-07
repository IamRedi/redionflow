import { describe, expect, it } from "vitest";
import { assetBarcode, assetIdentity, assetPlate } from "./asset-identity";
import { createWorkshopDemo } from "./demo-data";
import { applyCustodyCommand } from "./custody-flow";
import { demoOffice } from "./custody-schema";
import { publicWorkshopCommand, type WorkshopDirectory } from "./shared-contract";
import { workshopSchema, versionThreeWorkshopSchema } from "./demo-model";
import { resolveInventoryTag, upgradeWorkshopInventory } from "./inventory-flow";

const directory: WorkshopDirectory = { workers:[],sites:[] };
const details = {category:"vehicle" as const,manufacturer:"",model:"",serial:"",note:""};
const id = "c8b4019a-ddcf-4435-b334-b53796b38764", now = "2026-11-06T20:00:00.000Z";
const register = {type:"register" as const,assetId:id,name:"DEMO Fahrzeug",inspection:"2027-11-01",details};
const apply = (state: ReturnType<typeof createWorkshopDemo>, command: unknown) => applyCustodyCommand(state,publicWorkshopCommand.parse(command),demoOffice,directory,now,"test-request");

describe("vehicle plates and optional additional inventory labels",()=>{
  it("upgrades V3 by version only and makes old V3 writers fail closed on V4",()=>{
    const old={...createWorkshopDemo(),version:3}, raw=JSON.stringify(old);
    const upgraded=upgradeWorkshopInventory(old,directory);
    expect(upgraded).toEqual({...old,version:4}); expect(JSON.stringify(old)).toBe(raw);
    expect(versionThreeWorkshopSchema.safeParse(upgraded).success).toBe(false);
    expect(upgradeWorkshopInventory(upgraded,directory)).toEqual(upgraded);
  });
  it("reads old fleet plates without rewriting data or treating them as barcodes",()=>{
    const state=createWorkshopDemo(), raw=JSON.stringify(state), asset=state.assets.find(a=>a.id==="truck")!;
    expect(assetPlate(asset)).toBe("MU-BD 101"); expect(assetBarcode(asset)).toBeUndefined();
    expect(resolveInventoryTag(" mu-bd 101 ",state.assets,"https://demo.test")?.id).toBe("truck");
    expect(workshopSchema.parse(state)).toEqual(state); expect(JSON.stringify(state)).toBe(raw);
  });
  it("requires an actual plate and never auto-creates a vehicle barcode",()=>{
    expect(()=>apply(createWorkshopDemo(),register)).toThrow("required");
    const a=apply(createWorkshopDemo(),{...register,plate:" mu-ab 27 "}).assets[0];
    expect(a).toMatchObject({id,code:"MU-AB 27",plate:"MU-AB 27",kind:"fleet"}); expect(assetBarcode(a)).toBeUndefined();
  });
  it("resolves plate and an explicitly assigned additional barcode to the same unit",()=>{
    const state=apply(createWorkshopDemo(),{...register,plate:"MU-AB 27",barcode:"BDF-VEHICLE-27"});
    for(const value of ["MU-AB 27","bdf-vehicle-27"]) expect(resolveInventoryTag(value,state.assets,"https://demo.test")?.id).toBe(id);
    expect(assetIdentity(state.assets[0])).toBe("MU-AB 27");
    expect(()=>apply(createWorkshopDemo(),{...register,plate:"MU-AB 27",barcode:"MU-AB 27"})).toThrow("required");
  });
  it("rejects identifier collisions across plates, tool tags and optional barcodes",()=>{
    for(const value of ["WG-101","MU-BD 201"]) expect(()=>apply(createWorkshopDemo(),{...register,plate:"MU-AB 27",barcode:value})).toThrow("duplicate");
    expect(()=>apply(createWorkshopDemo(),{...register,plate:"MU-BD 201"})).toThrow("duplicate");
  });
  it("preserves record identity, repairs and documents when a plate or optional tag changes",()=>{
    const before=createWorkshopDemo(), original=before.assets.find(a=>a.id==="chipper")!;
    const next=apply(before,{type:"edit-asset",assetId:original.id,name:original.name,details,plate:"MU-NEU 9",barcode:"BDF-CHIPPER-9"});
    const asset=next.assets.find(a=>a.id===original.id)!;
    expect(asset.code).toBe(original.code); expect(assetPlate(asset)).toBe("MU-NEU 9");
    expect(asset.events.slice(1)).toEqual(original.events); expect(next.jobs).toEqual(before.jobs); expect(next.documents).toEqual(before.documents);
    expect(JSON.parse(asset.events[0].note)).toMatchObject({before:{plate:"MU-BD 201"},after:{plate:"MU-NEU 9",barcode:"BDF-CHIPPER-9"}});
    const removed=apply(next,{type:"edit-asset",assetId:asset.id,name:asset.name,details,barcode:""});
    expect(assetBarcode(removed.assets.find(a=>a.id===asset.id)!)).toBeUndefined();
    expect(assetBarcode(before.assets.find(a=>a.id==="saw")!)).toBe("WG-101");
  });
});

import { z } from "zod";
import { applyStepCommand, batchState, initialFactorySteps, type FactoryStep, type StepCommand } from "@/lib/factory/production";
import { actorSchema, type DemoActor } from "./custody-schema";
import type { WorkshopDirectory } from "./shared-contract";
import type { MediaPreference } from "./media";

const id = z.string().trim().min(1).max(128), label = z.string().trim().min(1).max(120);
const note = z.string().trim().max(2000), at = z.iso.datetime();
export const volumeUnits = ["Fm", "Rm", "Srm"] as const;
export const woodIcons = ["logs", "cut", "split", "dry", "pack", "truck", "tree", "shield", "leaf"] as const;
export type WoodIcon = typeof woodIcons[number];
export const woodArtIds = ["wood-yard", "wood-cutting", "wood-splitting", "wood-packing"] as const;
export const definitionSchema = z.object({ id, kind: z.enum(["wood", "site"]), label, description: note, icon: z.enum(woodIcons), art: z.enum(woodArtIds).optional(), requiresTrees:z.boolean().default(false), archived: z.boolean() });
export type WorkDefinition = z.infer<typeof definitionSchema>;
const stepSchema = z.object({ key: id, status: z.enum(["todo", "active", "done", "blocked"]), note, by: z.string().max(160), at: z.string() });
const assignments=z.object({workers:z.array(id).max(30),equipment:z.array(id).max(30)});
const event = z.object({ id, target: id, kind: id, note, at, actor: actorSchema,definitionChange:z.object({before:definitionSchema.optional(),after:definitionSchema}).optional(),assignmentChange:z.object({before:assignments,after:assignments}).optional() });
export const intakeSchema = z.object({ id, species: label, sourceKey: id.optional(), sourceName: label, quantity: z.number().int().min(1).max(100_000_000), unit: z.enum(volumeUnits), note, at, actor: actorSchema });
export const workJobSchema = z.object({ id, kind: z.enum(["wood", "site"]), label, sourceId: id.optional(), sourceQuantity: z.number().int().positive().optional(), siteKey: id.optional(), siteName: z.string().optional(), workers: z.array(id).max(30), equipment: z.array(id).max(30), phases: z.array(definitionSchema).min(1).max(20), steps: z.array(stepSchema).min(1).max(20), cancelled: z.boolean(), at, actor: actorSchema });
export type WorkJob = z.infer<typeof workJobSchema>;
export const outputSchema = z.object({ id, jobId: id, label, unit: z.enum(volumeUnits), packages: z.number().int().positive().max(100_000), perPackage: z.number().int().positive().max(100_000_000), at, actor: actorSchema });
export const dispatchSchema = z.object({ id, outputId: id, packages: z.number().int().positive().max(100_000), recipient: label, reason: z.enum(["sale", "delivery"]), at, actor: actorSchema });
export const woodStateSchema = z.object({ version: z.literal(1), definitions: z.array(definitionSchema).max(160), intakes: z.array(intakeSchema).max(1000), jobs: z.array(workJobSchema).max(1000), outputs: z.array(outputSchema).max(1000), dispatches: z.array(dispatchSchema).max(4000), events: z.array(event).max(12000) });
export type WoodState = z.infer<typeof woodStateSchema>;
const phaseCommand = z.discriminatedUnion("kind", [z.object({kind:z.literal("start")}).strict(),z.object({kind:z.literal("done")}).strict(),z.object({kind:z.literal("reopen")}).strict(),z.object({kind:z.literal("block"),text:label}).strict(),z.object({kind:z.literal("unblock")}).strict(),z.object({kind:z.literal("note"),text:note}).strict()]);
export const woodCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("definition"), id: id.optional(), kind: z.enum(["wood", "site"]), label, description: note, icon: z.enum(woodIcons), archived: z.boolean(),requiresTrees:z.boolean().default(false) }).strict(),
  z.object({ type: z.literal("intake"), species: label, sourceKey: id.optional(), supplier: label.optional(), quantity: z.number().int().min(1).max(100_000_000), unit: z.enum(volumeUnits), note }).strict(),
  z.object({ type: z.literal("job"), kind: z.enum(["wood", "site"]), label, sourceId: id.optional(), sourceQuantity: z.number().int().positive().max(100_000_000).optional(), siteKey: id.optional(), phases: z.array(id).min(1).max(20), workers: z.array(id).max(30), equipment: z.array(id).max(30) }).strict(),
  z.object({ type: z.literal("step"), jobId: id, index: z.number().int().min(0).max(19), command: phaseCommand }).strict(),
  z.object({ type: z.literal("cancel"), jobId: id, note: label }).strict(),
  z.object({ type:z.literal("team"),jobId:id,workers:z.array(id).max(30),equipment:z.array(id).max(30) }).strict(),
  z.object({ type: z.literal("output"), jobId: id, label, unit: z.enum(volumeUnits), packages: z.number().int().min(1).max(100_000), perPackage: z.number().int().min(1).max(100_000_000) }).strict(),
  z.object({ type: z.literal("dispatch"), outputId: id, packages: z.number().int().min(1).max(100_000), recipient: label, reason: z.enum(["sale", "delivery"]) }).strict(),
]);
export type WoodCommand = z.infer<typeof woodCommandSchema>;
export const woodEnvelope = z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),command:woodCommandSchema}).strict();
export const woodMediaEnvelope = z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),target:id,kind:z.enum(["phase", "job", "intake"])}).strict();
export type WoodMediaTarget = z.infer<typeof woodMediaEnvelope>;
export type WoodMedia = {id:string;target:string;kind:"phase"|"job"|"intake";name:string;url:string;at:string};
export type WoodEquipment={id:string;available:boolean;holder?:string;site?:string;pending?:boolean};
export type WoodSnapshot = WoodState & {revision:number;actor:DemoActor;directory:WorkshopDirectory;equipment:Array<WoodEquipment&{name:string}>;openTrees:Record<string,number>;media:WoodMedia[];mediaPreferences?:MediaPreference[];illustrations:Array<{id?:string;target:string;status:string;url?:string;error?:string;legacy?:boolean}>;imageGenerationEnabled:boolean};
export class WoodError extends Error {}
const normalize = (text:string)=>text.normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase("de");
const builtin = (key:string,kind:"wood"|"site",label:string,icon:WoodIcon,art?:WorkDefinition["art"]): WorkDefinition => ({id:`phase-${key}`,kind,label,description:"",icon,art,requiresTrees:["prune","fell","hedge"].includes(key),archived:false});
export function initialWoodState(): WoodState { return {version:1,definitions:[
  builtin("receive","wood","Holz annehmen","logs","wood-yard"), builtin("cut","wood","Sägen","cut","wood-cutting"), builtin("split","wood","Spalten","split","wood-splitting"), builtin("dry","wood","Trocknen & prüfen","dry"), builtin("pack","wood","Verpacken","pack","wood-packing"), builtin("load","wood","Verladevorbereitung","truck"),
  builtin("secure","site","Baustelle sichern","shield"),builtin("prune","site","Baumpflege","tree"),builtin("fell","site","Fällen","cut"),builtin("hedge","site","Hecke schneiden","leaf"),builtin("clear","site","Räumen & abtransportieren","truck"),
],intakes:[],jobs:[],outputs:[],dispatches:[],events:[]}; }
/** Created once in this fictional company, never reseeded over persisted work. */
export function seedWoodState(directory:WorkshopDirectory):WoodState {
  const state=initialWoodState(),actor:DemoActor={key:"admin",name:"Musterfirma · Büro",role:"admin"},at="2026-11-06T08:00:00.000Z",source=directory.sites.find(s=>s.active);
  if(!source)return state;
  state.intakes.push({id:"wood-sample-beech",species:"Buche · Musterlos",sourceKey:source.key,sourceName:source.name,quantity:8000,unit:"Fm",note:"Fiktives Musterlos; separat gemessene Mengen, keine automatische Umrechnung.",at,actor});
  const make=(id:string,kind:"wood"|"site",label:string,keys:string[],quantity?:number):WorkJob=>({id,kind,label,sourceId:quantity?"wood-sample-beech":undefined,sourceQuantity:quantity,siteKey:source.key,siteName:source.name,workers:directory.workers.slice(0,2).map(w=>w.key),equipment:[],phases:keys.map(key=>structuredClone(state.definitions.find(d=>d.id===`phase-${key}`)!)),steps:initialFactorySteps(keys.map(key=>`phase-${key}`)),cancelled:false,at,actor});
  const active=make("wood-sample-active","wood","Buchenholz 33 cm · Musterauftrag",["cut","split","dry","pack"],3000);active.steps[0]={...active.steps[0],status:"done",by:actor.name,at};active.steps[1]={...active.steps[1],status:"active",by:actor.name,at};
  const ready=make("wood-sample-ready","wood","Buchenholz · Musterbestand",["cut","split","dry","pack"],2000);ready.steps=ready.steps.map(s=>({...s,status:"done",by:actor.name,at}));
  const site=make("wood-sample-site","site","Baumpflege · Musterablauf",["secure","prune","clear"]);site.steps[0]={...site.steps[0],status:"done",by:actor.name,at};
  state.jobs.push(active,ready,site);state.outputs.push({id:"wood-sample-output",jobId:ready.id,label:"Buche 33 cm · Musterpaket",unit:"Rm",packages:3,perPackage:1000,at,actor});state.dispatches.push({id:"wood-sample-sale",outputId:"wood-sample-output",packages:1,recipient:"Musterabholung",reason:"sale",at,actor});
  state.events.push(...state.jobs.map(j=>({id:`sample-event-${j.id}`,target:j.id,kind:"job",note:"Fiktiver Ausgangsstand zur Erprobung der Arbeitsabläufe.",at,actor})),{id:"sample-output-event",target:ready.id,kind:"output",note:"3 × 1 Rm · separat gemessener Musterausgang",at,actor},{id:"sample-sale-event",target:ready.id,kind:"sale",note:"1 × 1 Rm · Musterabholung",at,actor});
  return state;
}
export function intakeAvailable(state:WoodState,intakeId:string){const intake=state.intakes.find(i=>i.id===intakeId);return intake ? intake.quantity-state.jobs.filter(j=>!j.cancelled&&j.sourceId===intakeId).reduce((n,j)=>n+(j.sourceQuantity??0),0):0;}
export function stockPackages(state:WoodState,outputId:string){const output=state.outputs.find(o=>o.id===outputId);return output ? output.packages-state.dispatches.filter(d=>d.outputId===outputId).reduce((n,d)=>n+d.packages,0):0;}
export function volumeText(milli:number,unit:typeof volumeUnits[number],lang="de"){const text=(milli/1000).toFixed(3).replace(/\.?0+$/,"");return `${lang==="en"?text:text.replace(".",",")} ${unit}`;}
export function woodCanExecute(job:WorkJob,actor:DemoActor){return actor.role==="admin"||job.workers.includes(actor.key);}
export type WoodDirectory = WorkshopDirectory & {equipment:WoodEquipment[];openTrees?:Record<string,number>};
/** Pure command application; the store serializes it with repairs and stock mutations. */
export function applyWoodCommand(input:WoodState,command:WoodCommand,actor:DemoActor,directory:WoodDirectory,now:string,newId:string):WoodState {
  const state=structuredClone(input);
  const fail=(code:string):never=>{throw new WoodError(code);};
  const admin=()=>{if(actor.role!=="admin")fail("permission");};
  const record=(target:string,kind:string,text="")=>state.events.unshift({id:newId,target,kind,note:text,at:now,actor});
  const site=(key:string|undefined)=>{const s=directory.sites.find(s=>s.key===key&&s.active);if(!s)fail("missing");return s!;};
  const getJob=(id:string)=>{const j=state.jobs.find(j=>j.id===id&&!j.cancelled);if(!j)fail("missing");return j!;};
  const unique=(keys:string[])=>{if(new Set(keys).size!==keys.length)fail("duplicate");};
  switch(command.type){
    case "definition":{
      admin(); const current=command.id?state.definitions.find(d=>d.id===command.id):undefined;
      if(command.id&&!current)fail("missing"); if(current&&current.kind!==command.kind)fail("required");
      if(state.definitions.some(d=>d.id!==current?.id&&d.kind===command.kind&&normalize(d.label)===normalize(command.label)))fail("duplicate");
      const before=current?structuredClone(current):undefined;
      if(current){if(normalize(current.label)!==normalize(command.label)||current.icon!==command.icon)delete current.art;Object.assign(current,{label:command.label,description:command.description,icon:command.icon,archived:command.archived,requiresTrees:command.kind==="site"&&command.requiresTrees});}
      else state.definitions.push({id:newId,kind:command.kind,label:command.label,description:command.description,icon:command.icon,archived:command.archived,requiresTrees:command.kind==="site"&&command.requiresTrees});
      record(current?.id??newId,"definition",command.label);state.events[0].definitionChange={before,after:structuredClone(state.definitions.find(d=>d.id===(current?.id??newId))!)};break;
    }
    case "intake":{
      admin();const source=command.sourceKey?site(command.sourceKey):undefined;if(!source&&!command.supplier)fail("required");
      state.intakes.unshift({id:newId,species:command.species,sourceKey:source?.key,sourceName:source?.name??command.supplier!,quantity:command.quantity,unit:command.unit,note:command.note,at:now,actor});record(newId,"intake",command.note);break;
    }
    case "job":{
      admin();unique(command.phases);unique(command.workers);unique(command.equipment);
      const source=command.sourceId?state.intakes.find(i=>i.id===command.sourceId):undefined;
      if(command.kind==="wood"&&(!source||!command.sourceQuantity||command.sourceQuantity>intakeAvailable(state,source.id)))fail("stock");
      if(command.kind==="site"&&(command.sourceId||command.sourceQuantity))fail("required");
      const location=command.siteKey?site(command.siteKey):source?.sourceKey?directory.sites.find(s=>s.key===source.sourceKey):undefined;
      if(command.kind==="site"&&!location)fail("required");
      const phases=command.phases.map(key=>{const phase=state.definitions.find(d=>d.id===key&&!d.archived&&d.kind===command.kind);if(!phase)fail("missing");return structuredClone(phase!);});
      if(command.workers.some(key=>!directory.workers.some(w=>w.key===key)))fail("missing");
      if(command.equipment.some(key=>!directory.equipment.some(e=>e.id===key&&e.available)))fail("equipment");
      if(command.kind==="site"&&state.jobs.some(j=>!j.cancelled&&j.kind==="site"&&j.siteKey===location!.key&&batchState(j.steps)!=="ready"&&j.phases.map(p=>p.id).sort().join()===[...command.phases].sort().join()))fail("duplicate");
      state.jobs.unshift({id:newId,kind:command.kind,label:command.label,sourceId:source?.id,sourceQuantity:command.sourceQuantity,siteKey:location?.key,siteName:location?.name,workers:command.workers,equipment:command.equipment,phases,steps:initialFactorySteps(command.phases),cancelled:false,at:now,actor});record(newId,"job",command.label);break;
    }
    case "step":{
      const job=getJob(command.jobId);if(!woodCanExecute(job,actor))fail("permission");
      if(state.outputs.some(o=>o.jobId===job.id))fail("booked");
      if(["start","done","unblock"].includes(command.command.kind)&&job.equipment.some(key=>!directory.equipment.some(e=>e.id===key&&e.available)))fail("equipment");
      if(["start","done","unblock"].includes(command.command.kind)&&state.jobs.some(other=>other.id!==job.id&&!other.cancelled&&other.steps.some(s=>s.status==="active")&&other.equipment.some(id=>job.equipment.includes(id))))fail("equipment");
      if(["start","done","unblock"].includes(command.command.kind)&&job.equipment.some(key=>{const e=directory.equipment.find(e=>e.id===key)!;return e.pending||!(e.holder&&job.workers.includes(e.holder)||e.site&&e.site===job.siteKey);}))fail("custody");
      if(["start","done","unblock","block"].includes(command.command.kind)&&job.steps.slice(0,command.index).some(s=>s.status!=="done"))fail("sequence");
      if(["start","done"].includes(command.command.kind)&&job.steps[command.index]?.status==="blocked")fail("sequence");
      if(command.command.kind==="done"&&job.phases[command.index]?.requiresTrees&&(!job.siteKey||directory.openTrees?.[job.siteKey]!==0))fail("trees");
      try{const change=applyStepCommand(job.steps as FactoryStep[],command.index,command.command as StepCommand,actor.name,new Date(now));job.steps=change.steps;record(job.id,command.command.kind,`${job.phases[command.index].label}${change.event.note?`: ${change.event.note}`:""}`);}
      catch{fail("sequence");}break;
    }
    case "cancel":{admin();const job=getJob(command.jobId);if(job.steps.some(s=>s.status!=="todo")||state.outputs.some(o=>o.jobId===job.id))fail("sequence");job.cancelled=true;record(job.id,"cancel",command.note);break;}
    case "team":{
      admin();const job=getJob(command.jobId);unique(command.workers);unique(command.equipment);if(state.outputs.some(o=>o.jobId===job.id))fail("booked");
      if(command.workers.some(key=>!directory.workers.some(w=>w.key===key)))fail("missing");
      const changed=job.equipment.slice().sort().join()!==command.equipment.slice().sort().join();
      if(changed&&job.steps.some(s=>s.status==="active"))fail("sequence");
      if(changed&&command.equipment.some(key=>!directory.equipment.some(e=>e.id===key&&e.available)))fail("equipment");
      const before={workers:[...job.workers],equipment:[...job.equipment]};job.workers=command.workers;job.equipment=command.equipment;record(job.id,"team");state.events[0].assignmentChange={before,after:{workers:[...job.workers],equipment:[...job.equipment]}};break;
    }
    case "output":{
      admin();const job=getJob(command.jobId);if(job.kind!=="wood"||batchState(job.steps)!=="ready")fail("sequence");if(state.outputs.some(o=>o.jobId===job.id))fail("booked");
      if(!Number.isSafeInteger(command.packages*command.perPackage)||command.packages*command.perPackage>100_000_000)fail("required");
      state.outputs.unshift({id:newId,jobId:job.id,label:command.label,unit:command.unit,packages:command.packages,perPackage:command.perPackage,at:now,actor});record(job.id,"output",`${command.packages} × ${volumeText(command.perPackage,command.unit)}`);break;
    }
    case "dispatch":{
      admin();const output=state.outputs.find(o=>o.id===command.outputId);if(!output||command.packages>stockPackages(state,command.outputId))fail("stock");
      state.dispatches.unshift({id:newId,outputId:command.outputId,packages:command.packages,recipient:command.recipient,reason:command.reason,at:now,actor});record(output!.jobId,command.reason,`${command.packages} × ${volumeText(output!.perPackage,output!.unit)} · ${command.recipient}`);break;
    }
  }
  return woodStateSchema.parse(state);
}

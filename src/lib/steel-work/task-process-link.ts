/** Standard production phases represent the same operation on the material list.
 * Exact catalog names only: never fuzzy-match a custom task or use photo/AI hints. */
type Definition = { key?:string; label?:string; phaseGroup?:string|null; linkedProcessKey?:string|null; linkedList?:string|null; linkedKind?:string|null };
const aliases:Record<string,string>={
 cutting:'cutting',prerje:'cutting',assembly:'assembly',asamblim:'assembly',asambim:'assembly',
 welding:'welding',saldim:'welding',cleaning:'cleaning',pastrim:'cleaning',
 coating:'coating',painting:'coating',lyerje:'coating',loading:'loading',ngarkim:'loading',
};
export function effectiveTaskProcessLink(definition:Definition) {
 const label=(definition.label??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
 const candidate=label || (definition.key??'').replace(/^steel-/,'');
 const explicitCustom=/^(?:fp|sp)-[a-f0-9]{24}$/.test(definition.linkedProcessKey??'');
 const standard=definition.phaseGroup==='production'&&!explicitCustom&&Object.hasOwn(aliases,candidate)?aliases[candidate]:undefined;
 return standard?{linkedProcessKey:standard,linkedList:null,linkedKind:definition.linkedKind??null}
  :{linkedProcessKey:definition.linkedProcessKey??null,linkedList:definition.linkedList??null,linkedKind:definition.linkedKind??null};
}

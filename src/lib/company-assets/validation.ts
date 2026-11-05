import { z } from 'zod';
const id = z.string().trim().min(1).max(128), note = z.string().trim().min(1).max(2000), revision = z.number().int().min(0);
export const assetRefSchema = z.object({ kind: z.enum(['machine','inventory']), id }).strict();
const optionalNote = z.string().trim().max(2000).optional();
export const assetMutationSchema = z.object({ requestId: z.uuid(), command: z.discriminatedUnion('type', [
  z.object({ type:z.literal('report'),asset:assetRefSchema,kind:z.enum(['defect','lost','retire']),note }).strict(),
  z.object({ type:z.literal('decide-incident'),incidentId:id,revision,approve:z.boolean(),note }).strict(),
  z.object({ type:z.literal('handover'),asset:assetRefSchema,kind:z.enum(['issue','return','transfer']),toWorkerId:id.optional(),siteId:id.optional(),note:optionalNote }).strict(),
  z.object({ type:z.enum(['confirm-handover','decline-handover','cancel-handover']),handoverId:id,revision,note:optionalNote }).strict(),
  z.object({ type:z.literal('repair-phase'),repairId:id,revision,phase:z.enum(['received','repairing','ready']),repairNote:optionalNote,tested:z.boolean().optional() }).strict(),
  z.object({ type:z.literal('repair-location'),repairId:id,revision,location:z.enum(['internal','external']),provider:z.string().trim().max(200).optional(),note }).strict(),
  z.object({ type:z.literal('repair-note'),repairId:id,revision,note }).strict(),
  z.object({ type:z.literal('restore'),asset:assetRefSchema,revision,note }).strict(),
  z.object({ type:z.literal('register'),name:z.string().trim().min(1).max(120),category:z.enum(['tool','clothing','equipment']),code:z.string().trim().max(80).optional(),barcode:z.string().trim().max(128).optional(),size:z.string().trim().max(80).optional(),note:optionalNote,quantity:z.number().int().min(1).max(100).optional() }).strict(),
  z.object({ type:z.literal('edit'),asset:assetRefSchema,revision,name:z.string().trim().min(1).max(120),size:z.string().trim().max(80).optional(),note:optionalNote }).strict(),
]) }).strict();
export const assetQuerySchema = z.object({query:z.string().trim().max(120).optional(),page:z.number().int().min(1).max(100000).optional(),category:z.enum(['vehicle','tool','clothing','equipment']).optional(),includeInactive:z.boolean().optional(),workerId:id.optional()}).strict();

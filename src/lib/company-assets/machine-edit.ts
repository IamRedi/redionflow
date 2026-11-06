import { z } from 'zod';

export const machineTextFields = ['name', 'nickname', 'model', 'targe', 'funksioni', 'patentaEnevojshme', 'ownership', 'notes'] as const;
export const machineDateFields = ['tuvDate', 'auDate', 'spDate', 'uvvDate', 'insuranceDate', 'taxDate', 'transportPermitDate', 'tachographDate'] as const;
const text = z.string().trim().max(120).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}).nullable();
export const machineEditSchema = z.object({
  id: z.string().min(1).max(100), version: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1).max(120), nickname: text, model: text, targe: text,
  funksioni: text, patentaEnevojshme: text, ownership: text, notes: z.string().trim().max(2000).nullable(),
  category: z.enum(['TRUCK', 'AWP', 'CHIPPER', 'CHAINSAW', 'OTHER']),
  vitiProdhimit: z.number().int().min(1900).max(2200).nullable(),
  vitiBlerjes: z.number().int().min(1900).max(2200).nullable(),
  tonnage: z.number().finite().min(0).max(10000).nullable(), isActive: z.boolean(),
  tuvDate: date, auDate: date, spDate: date, uvvDate: date,
  insuranceDate: date, taxDate: date, transportPermitDate: date, tachographDate: date,
}).strict();
export type MachineEdit = z.infer<typeof machineEditSchema>;

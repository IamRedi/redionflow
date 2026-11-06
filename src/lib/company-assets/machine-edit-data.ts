import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { parseMachineNotes } from '@/lib/workzone/machine-notes';
import { machineDateFields, type MachineEdit } from './machine-edit';

export const machineEditSelect = {
  id: true, name: true, nickname: true, model: true, targe: true,
  funksioni: true, patentaEnevojshme: true, ownership: true, notes: true, category: true,
  vitiProdhimit: true, vitiBlerjes: true, tonnage: true, isActive: true,
  tuvDate: true, auDate: true, spDate: true, uvvDate: true, insuranceDate: true,
  taxDate: true, transportPermitDate: true, tachographDate: true,
} satisfies Prisma.MachineSelect;
type Row = Prisma.MachineGetPayload<{ select: typeof machineEditSelect }>;
/** GPS and photo updates do not invalidate an unrelated paperwork draft. */
export function editableMachine(row: Row): MachineEdit {
  const fields = { ...row, notes: parseMachineNotes(row.notes).body || null,
    ...Object.fromEntries(machineDateFields.map(key => [key, row[key]?.toISOString().slice(0, 10) ?? null])) };
  const canonical = Object.keys(fields).sort().map(key => [key, fields[key as keyof typeof fields]]);
  return { ...fields, version: createHash('sha256').update(JSON.stringify(canonical)).digest('hex') } as MachineEdit;
}

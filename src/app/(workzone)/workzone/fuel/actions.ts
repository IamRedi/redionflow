'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  prepareFuelReceipt,
  confirmFuelReceipt,
  readFuelReceipt,
  readOlderFuelReceipts,
  FuelError,
} from '@/lib/fleet/fuel/service';
import { captureFuelGps } from '@/lib/fleet/wanway/service';

const schema = z.object({
  id: z.string().regex(/^[a-z0-9]{10,40}$/i),
  clock: z.string().max(32),
  stationAddress: z.string().trim().max(240),
  liters: z.number().positive().max(10000).nullable(),
  amount: z.number().nonnegative().max(100_000_000).nullable(),
  fueledByWorkerId: z.string().max(64).nullable().optional(),
  utcOffset: z
    .union([z.literal(1), z.literal(2)])
    .nullable()
    .optional(),
});
const code = (error: unknown) =>
  error instanceof FuelError
    ? error.message
    : error instanceof Error && error.message === 'FLEET_UNAUTHORIZED'
      ? 'UNAUTHORIZED'
      : 'UNAVAILABLE';

export async function uploadFuelAction(form: FormData) {
  try {
    const row = await prepareFuelReceipt(
      String(form.get('machineId') ?? ''),
      String(form.get('requestId') ?? ''),
      form.get('file') as File,
    );
    revalidatePath('/workzone/fuel');
    return { ok: true as const, row };
  } catch (error) {
    return { ok: false as const, code: code(error) };
  }
}
export async function confirmFuelAction(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: 'INVALID' };
  try {
    const d = parsed.data;
    const row = await confirmFuelReceipt(
      d.id,
      d.clock,
      d.stationAddress,
      d.liters,
      d.amount,
      d.utcOffset,
      d.fueledByWorkerId,
    );
    revalidatePath('/workzone/fuel');
    return { ok: true as const, row };
  } catch (error) {
    return { ok: false as const, code: code(error) };
  }
}
export async function retryFuelGpsAction(id: string) {
  if (!/^[a-z0-9]{10,40}$/i.test(id))
    return { ok: false as const, code: 'INVALID' };
  try {
    await captureFuelGps(id);
    const row = await readFuelReceipt(id);
    revalidatePath('/workzone/fuel');
    return { ok: true as const, row };
  } catch (error) {
    return { ok: false as const, code: code(error) };
  }
}

export async function olderFuelAction(
  machineId: string | null,
  cursor: { id: string; uploadedAt: string },
) {
  try {
    return {
      ok: true as const,
      ...(await readOlderFuelReceipts(machineId, cursor)),
    };
  } catch (error) {
    return { ok: false as const, code: code(error) };
  }
}

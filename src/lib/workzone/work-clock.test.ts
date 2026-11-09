import { expect, it } from 'vitest';
import { dateKey, parseWorkDateTime, workDateTimeInput } from './date-utils';
import { planMachineLabel } from './plan-machine-label';
it('round-trips company clocks in winter and summer independently of the server/browser zone',()=>{
 expect(parseWorkDateTime('2026-11-10T07:00')?.toISOString()).toBe('2026-11-10T06:00:00.000Z');
 expect(parseWorkDateTime('2026-07-10T07:00')?.toISOString()).toBe('2026-07-10T05:00:00.000Z');
 expect(workDateTimeInput(new Date('2026-11-09T23:30Z'))).toBe('2026-11-10T00:30');
 expect(dateKey(parseWorkDateTime('2026-11-10T00:30')!)).toBe('2026-11-10');
 expect(parseWorkDateTime('2026-03-29T02:30')).toBeNull();
 expect(parseWorkDateTime('2026-02-30T07:00')).toBeNull();
 expect(parseWorkDateTime('not-a-clock')).toBeNull();
 expect(parseWorkDateTime('2026-11-10T06:00:00Z')?.toISOString()).toBe('2026-11-10T06:00:00.000Z');
});
it('keeps distinct plates on compact same-name machine labels',()=>{
 expect(planMachineLabel({name:'Excavator large',targe:'ZZ 101 DM'})).toBe('Excavator · ZZ 101 DM');
 expect(planMachineLabel({name:'Excavator small',targe:'ZZ 202 DM'})).toBe('Excavator · ZZ 202 DM');
 expect(planMachineLabel({name:'Factory forklift',nickname:'   ',targe:null})).toBe('Factory');
});

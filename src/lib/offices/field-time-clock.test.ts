import { expect,it } from 'vitest';
import { fieldClockTime } from './field-time-clock';
const schedule={start:'07:00',end:'17:00',weekdays:[1,2,3,4,5,6]};
it('uses the company business timezone for remembered start/finish and never the click time',()=>{
 const now=new Date('2026-11-20T17:15:00Z');
 expect(fieldClockTime({mode:'schedule'},'start',schedule,null,now)?.toISOString()).toBe('2026-11-20T06:00:00.000Z');
 expect(fieldClockTime({mode:'schedule'},'stop',schedule,'2026-11-20T06:00Z',now)?.toISOString()).toBe('2026-11-20T16:00:00.000Z');
 expect(fieldClockTime({mode:'now'},'start',schedule,null,now)).toBe(now);
 expect(fieldClockTime({mode:'manual',at:'2026-11-20T08:20'},'start',schedule,null,now)?.toISOString()).toBe('2026-11-20T07:20:00.000Z');
 expect(fieldClockTime({mode:'schedule'},'start',schedule,null,new Date('2026-07-20T12:00Z'))?.toISOString()).toBe('2026-07-20T05:00:00.000Z');
});
it('rejects unknown schedules, nonworking days, future hours and stale/overnight fixed stops',()=>{
 const now=new Date('2026-11-20T10:00Z');
 expect(fieldClockTime({mode:'schedule'},'start',null,null,now)).toBeNull();
 expect(fieldClockTime({mode:'schedule'},'stop',schedule,'2026-11-20T06:00Z',now)).toBeNull();
 expect(fieldClockTime({mode:'schedule'},'start',schedule,null,new Date('2026-11-22T20:00Z'))).toBeNull();
 expect(fieldClockTime({mode:'schedule'},'stop',schedule,'2026-11-19T06:00Z',new Date('2026-11-20T20:00Z'))).toBeNull();
 expect(fieldClockTime({mode:'manual',at:'invalid'},'start',schedule,null,now)).toBeNull();
 expect(fieldClockTime({mode:'manual',at:'2026-11-20T06:59'},'stop',schedule,'2026-11-20T06:00Z',now)).toBeNull();
});

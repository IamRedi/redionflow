import {describe,it,expect} from 'vitest';
import {reminderCompany,reminderOutcome,validReminderTime,journalOrder} from './reminder-policy';
import {officeTaskInput} from './work-policy';
import {parseWorkDateTime} from '@/lib/workzone/date-utils';
describe('personal task reminders',()=>{
  const env={OFFICE_TASK_REMINDERS_ENABLED:'true',VIRTUAL_OFFICE_ENABLED:'true',VIRTUAL_OFFICE_WORK_ENABLED:'true',INSTALLATION_COMPANY_ID:'a',VIRTUAL_OFFICE_ACCESS_JSON:JSON.stringify({companyId:'a',megi:{adminId:'m'},almet:{adminId:'a'}})};
  it('fails closed without the installation, explicit flags or valid office identities',()=>{
    expect(reminderCompany(env)).toBe('a');
    for(const key of Object.keys(env))expect(reminderCompany({...env,[key]:''})).toBeNull();
    expect(reminderCompany({...env,INSTALLATION_COMPANY_ID:'foreign'})).toBeNull();
    expect(reminderCompany({...env,RLS_ENFORCE:'true'})).toBeNull();
    expect(reminderCompany({...env,VIRTUAL_OFFICE_ACCESS_JSON:JSON.stringify({companyId:'a',megi:{adminId:'m'},almet:{adminId:'m'}})})).toBeNull();
  });
  it('requires bounded future instants and keeps company clock semantics across travel and DST',()=>{
    const now=new Date('2026-11-13T10:00Z');
    expect(validReminderTime(new Date('2026-11-13T10:01Z'),now)).toBe(true);
    for(const value of ['invalid','2026-11-13T09:00Z','2028-01-01T10:00Z'])expect(validReminderTime(new Date(value),now)).toBe(false);
    expect(parseWorkDateTime('2026-11-13T12:30')?.toISOString()).toBe('2026-11-13T11:30:00.000Z');
    expect(parseWorkDateTime('2027-03-28T02:30')).toBeNull();
  });
  it('does not accept a local datetime without an explicit absolute offset at the server boundary',()=>{
    const base={id:crypto.randomUUID(),version:0,kind:'PERSONAL',title:'Demo',body:'',ownerId:'m',categoryId:null,status:'TODO',priority:'NORMAL',dueDate:null};
    expect(officeTaskInput.safeParse({...base,reminderAt:'2026-11-14T12:30'}).success).toBe(false);
    expect(officeTaskInput.safeParse({...base,reminderAt:'2026-11-14T12:30:00+01:00'}).success).toBe(true);
    expect(officeTaskInput.safeParse(base).success).toBe(true);
  });
  it('reports delivery failures honestly and bounds retries',()=>{
    expect(reminderOutcome(1,1,1)).toBe('SENT');expect(reminderOutcome(0,0,1)).toBe('NO_DEVICE');
    expect(reminderOutcome(0,1,2)).toBe('PENDING');expect(reminderOutcome(0,1,3)).toBe('FAILED');
  });
  it('keeps completion, importance and creation order stable without mutating the input',()=>{
    const row=(id:string,priority='NORMAL',status='TODO',createdAt='2026-11-13T10:00Z')=>({id,priority,status,createdAt});
    const input=[row('new-high','HIGH','TODO','2026-11-13T11:00Z'),row('old-normal'),row('done','HIGH','DONE'),row('old-high','HIGH')];
    expect(journalOrder(input).map(x=>x.id)).toEqual(['old-high','new-high','old-normal','done']);
    expect(input[0].id).toBe('new-high');
  });
});

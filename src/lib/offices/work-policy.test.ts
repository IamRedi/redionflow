import { describe,expect,it } from 'vitest';
import { officeTaskInput,officeReturn,canReadOfficeTask,isThreadParticipant,officeTimestamp } from './work-policy';
const task={id:'71ef3aa8-8d53-4b0d-a2da-e0605cb67097',version:0,kind:'PERSONAL',title:'Call supplier',body:'',ownerId:'me',categoryId:null,status:'TODO',priority:'NORMAL',dueDate:null};
describe('private office contract',()=>{
 it('shows the same explicit company timezone without locale-dependent text',()=>{expect(officeTimestamp('2026-11-11T15:08:00.000Z')).toBe('11.11.2026 · 16:08');expect(officeTimestamp('2026-07-11T15:08:00.000Z')).toBe('11.07.2026 · 17:08');});
 it('accepts only real calendar dates and explicit office categories',()=>{
  expect(officeTaskInput.safeParse({...task,dueDate:'2026-02-30'}).success).toBe(false);
  expect(officeTaskInput.safeParse({...task,dueDate:'2028-02-29'}).success).toBe(true);
  expect(officeTaskInput.safeParse({...task,kind:'COMPANY'}).success).toBe(false);
  expect(officeTaskInput.safeParse({...task,kind:'COMPANY',categoryId:task.id}).success).toBe(true);
  expect(officeTaskInput.safeParse({...task,categoryId:task.id}).success).toBe(false);
 });
 it('does not grant private notes or mail to an administrator outside the participant set',()=>{
  expect(canReadOfficeTask({kind:'NOTE',ownerId:'me'},'owner-admin')).toBe(false);
  expect(canReadOfficeTask({kind:'PERSONAL',ownerId:'me'},'me')).toBe(true);
  expect(canReadOfficeTask({kind:'COMPANY',ownerId:'me'},'other-authorized-office-person')).toBe(false);
  expect(isThreadParticipant({senderId:'a',recipientId:'b'},'owner-admin')).toBe(false);
 });
 it('restricts return routes to the two known office destinations',()=>{
  expect(officeReturn('desk')).toBe('/workzone/offices/me');expect(officeReturn('reception')).toBe('/workzone/offices');
  for(const value of ['https://evil.test','//evil.test','/app/settings',['desk'],null])expect(officeReturn(value)).toBeNull();
 });
});

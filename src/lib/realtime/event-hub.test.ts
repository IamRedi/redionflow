import { expect,it } from 'vitest';
import { notifyRealtimeUpdate,subscribeRealtimeUpdates,withRealtimeBatch } from './event-hub';
it('coalesces a group to one tenant-scoped refresh and leaves other requests immediate',async()=>{
 const a:string[]=[],b:string[]=[];
 const stopA=subscribeRealtimeUpdates(v=>a.push(v),{companyProfileId:'a'}),stopB=subscribeRealtimeUpdates(v=>b.push(v),{companyProfileId:'b'});
 try{
  await withRealtimeBatch('a',async()=>{
   notifyRealtimeUpdate('worker.session.updated',['worker-strip']);
   notifyRealtimeUpdate('worker.session.updated',['worker-strip','working-badge']);
   notifyRealtimeUpdate('other.request',['daily-plan'],'b');
   expect(a).toHaveLength(0);expect(b).toHaveLength(1);
  });
  expect(a.map(v=>JSON.parse(v))).toEqual([{event:'worker.session.updated',scope:['worker-strip','working-badge'],companyProfileId:'a'}]);expect(b).toHaveLength(1);
  notifyRealtimeUpdate('individual',['worker-strip'],'a');expect(a).toHaveLength(2);
 }finally{stopA();stopB();}
});
it('flushes completed work after a partial failure and does not publish an empty group',async()=>{
 const rows:string[]=[],stop=subscribeRealtimeUpdates(v=>rows.push(v),{companyProfileId:'a'});
 try{
  await expect(withRealtimeBatch('a',async()=>{notifyRealtimeUpdate('worker.session.updated',['worker-strip']);throw new Error('Partial');})).rejects.toThrow('Partial');expect(rows).toHaveLength(1);
  await withRealtimeBatch('a',async()=>undefined);expect(rows).toHaveLength(1);
 }finally{stop();}
});

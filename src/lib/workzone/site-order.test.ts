import {expect,it} from 'vitest';
import {orderWorkzoneSites} from './site-order';
const site=(id:string,name:string,activeLiveCount=0,liveSince:string|null=null)=>({id,name,activeLiveCount,liveSince});
it('puts actual crews before idle sites, then orders idle names alphabetically despite stale timestamps',()=>{
 const input=[site('z','Zulu',0,'2099-01-01'),site('a','Alpha'),site('c','Crew',1,'2026-11-12T10:00Z'),site('b','Beta')];
 expect(orderWorkzoneSites(input).map(s=>s.id)).toEqual(['c','a','b','z']);expect(input[0].id).toBe('z');
});
it('keeps newly activated sites first and handles missing/invalid live timestamps deterministically',()=>{
 const input=[site('idle','Alpha'),site('old','Older',1,'2026-11-12T09:00Z'),site('new','Newer',1,'2026-11-12T10:00Z'),site('invalid','Zulu',1,'invalid')];
 expect(orderWorkzoneSites(input).map(s=>s.id)).toEqual(['new','old','invalid','idle']);
 expect(orderWorkzoneSites([site('b','Same'),site('a','Same')]).map(s=>s.id)).toEqual(['a','b']);
});

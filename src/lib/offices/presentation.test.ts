import {describe, expect, it} from 'vitest';
import {receptionOrder} from './presentation';

describe('reception presentation order', () => {
  const people = [
    {id:'staff-a',enabled:true,seat:'staff' as const,officePresence:null},
    {id:'owner',enabled:true,seat:'almet' as const,officePresence:null},
    {id:'admin',enabled:true,seat:'megi' as const,officePresence:null},
    {id:'staff-b',enabled:true,seat:'staff' as const,officePresence:null},
  ];
  it('shows the configured directors first when nobody is in the office', () => {
    expect(receptionOrder(people).map(p=>p.id)).toEqual(['admin','owner','staff-a','staff-b']);
    expect(people.map(p=>p.id)).toEqual(['staff-a','owner','admin','staff-b']);
  });
  it('prioritizes real office presence, including a paused office session', () => {
    const active = people.map(p=>({...p,officePresence:p.id==='staff-b'?'active' as const:p.id==='staff-a'?'paused' as const:null}));
    expect(receptionOrder(active).map(p=>p.id)).toEqual(['staff-a','staff-b','admin','owner']);
  });
  it('does not turn disabled rooms or an unrelated session into office presence', () => {
    const disabled = {...people[0],enabled:false,officePresence:'active' as const};
    expect(receptionOrder([disabled,...people.slice(1)]).map(p=>p.id)).toEqual(['admin','owner','staff-a','staff-b']);
  });
});

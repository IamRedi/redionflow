import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const dispatch=vi.hoisted(()=>vi.fn(async()=>({claimed:0,sent:0,cancelled:0,noDevice:0,failed:0})));
vi.mock('./task-reminders',()=>({dispatchOfficeReminders:dispatch}));
import {register} from '@/instrumentation';
const state=globalThis as typeof globalThis&{officeReminderTimer?:ReturnType<typeof setInterval>};
beforeEach(()=>{
 vi.useFakeTimers();dispatch.mockClear();
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_RUNTIME','nodejs');vi.stubEnv('RLS_ENFORCE','false');
 vi.stubEnv('OFFICE_TASK_REMINDERS_ENABLED','true');vi.stubEnv('VIRTUAL_OFFICE_ENABLED','true');vi.stubEnv('VIRTUAL_OFFICE_WORK_ENABLED','true');
 vi.stubEnv('INSTALLATION_COMPANY_ID','demo');vi.stubEnv('VIRTUAL_OFFICE_ACCESS_JSON',JSON.stringify({companyId:'demo',megi:{adminId:'m'},almet:{adminId:'a'}}));
});
afterEach(()=>{if(state.officeReminderTimer)clearInterval(state.officeReminderTimer);delete state.officeReminderTimer;vi.useRealTimers();vi.unstubAllEnvs();});
it('starts one Node-runtime worker and keeps processing without any open browser',async()=>{
 await register();await Promise.resolve();expect(dispatch).toHaveBeenCalledTimes(1);
 await register();expect(dispatch).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30_000);expect(dispatch).toHaveBeenCalledTimes(2);
});
it('does not activate on Edge, during build, without approval or inside the restricted RLS rollout',async()=>{
 vi.stubEnv('NEXT_RUNTIME','edge');await register();expect(dispatch).not.toHaveBeenCalled();
 vi.stubEnv('NEXT_RUNTIME','nodejs');vi.stubEnv('OFFICE_TASK_REMINDERS_ENABLED','false');await register();expect(dispatch).not.toHaveBeenCalled();
 vi.stubEnv('OFFICE_TASK_REMINDERS_ENABLED','true');vi.stubEnv('NEXT_PHASE','phase-production-build');await register();expect(dispatch).not.toHaveBeenCalled();
 vi.stubEnv('NEXT_PHASE','');vi.stubEnv('RLS_ENFORCE','true');await register();expect(dispatch).not.toHaveBeenCalled();
});

import { logger } from '@/lib/observability/logger';
import { reminderCompany } from './reminder-policy';
import { dispatchOfficeReminders } from './task-reminders';

const state=globalThis as typeof globalThis&{officeReminderTimer?:ReturnType<typeof setInterval>};
/** Railway's persistent Node server; no public cron endpoint or paid service. */
export function startOfficeReminderWorker() {
  if(process.env.NODE_ENV!=='production'||process.env.NEXT_PHASE==='phase-production-build'||!reminderCompany()||state.officeReminderTimer)return;
  let running=false;
  const tick=async()=>{
    if(running)return;
    running=true;
    try {
      const result=await dispatchOfficeReminders();
      if(result.claimed||result.failed)logger.info({event:'office.reminders.batch',...result},'office reminder batch');
    } catch {logger.error({event:'office.reminders.failed'},'office reminder batch could not complete');}
    finally {running=false;}
  };
  state.officeReminderTimer=setInterval(()=>void tick(),30_000);
  state.officeReminderTimer.unref();
  void tick();
}

/** Next.js resolves the hook next to src/app. The legacy root helper remains
 * unchanged; this entry point adds only the explicitly enabled reminder loop. */
export async function register() {
  if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.OFFICE_TASK_REMINDERS_ENABLED==='true') {
    const {startOfficeReminderWorker}=await import('@/lib/offices/reminder-worker');
    startOfficeReminderWorker();
  }
}

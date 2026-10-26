export function shouldAutoLockWorkLog(workDate: Date, now = new Date()): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWorkday = new Date(workDate);
  startOfWorkday.setHours(0, 0, 0, 0);

  return startOfWorkday.getTime() < startOfToday.getTime();
}


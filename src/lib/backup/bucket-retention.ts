/** Object key for a nightly backup: grouped by month so the bucket stays easy to browse. */
export function backupObjectKey(fileName: string) {
  const match = /^bauflow-(\d{4})-(\d{2})-\d{2}T[\w-]+\.enc$/.exec(fileName);
  if (!match) throw new Error("Unexpected backup file name");
  return `bauflow/${match[1]}-${match[2]}/${fileName}`;
}

/**
 * Backups older than the retention window. Never returns the copy that was
 * just written, and never empties the bucket: the newest copy always stays.
 */
export function expiredBackupKeys(
  objects: Array<{ key: string; lastModified?: Date }>,
  now: Date,
  retentionDays: number,
  keep: string,
) {
  const backups = objects.filter(o => o.key.startsWith("bauflow/") && o.key.endsWith(".enc") && o.lastModified);
  const newest = backups.reduce<{ key: string; lastModified?: Date } | null>((best, o) => (!best || o.lastModified! > best.lastModified! ? o : best), null);
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  return backups
    .filter(o => o.key !== keep && o.key !== newest?.key && o.lastModified!.getTime() < cutoff)
    .map(o => o.key);
}

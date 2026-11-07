import { expect, it } from "vitest";

import { backupObjectKey, expiredBackupKeys } from "./bucket-retention";

const day = 86_400_000;
const now = new Date("2026-11-07T19:00:00Z");
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * day);

it("groups backups by month and refuses unexpected names", () => {
  expect(backupObjectKey("bauflow-2026-11-07T19-01-49-718Z-4c47622fa0d9.enc")).toBe("bauflow/2026-11/bauflow-2026-11-07T19-01-49-718Z-4c47622fa0d9.enc");
  expect(() => backupObjectKey("../etc/passwd")).toThrow();
});

it("removes only copies older than the retention window", () => {
  const objects = [
    { key: "bauflow/2026-07/old.enc", lastModified: at(120) },
    { key: "bauflow/2026-08/edge.enc", lastModified: at(89) },
    { key: "bauflow/2026-11/new.enc", lastModified: at(0) },
    { key: "other/notes.txt", lastModified: at(400) },
  ];
  expect(expiredBackupKeys(objects, now, 90, "bauflow/2026-11/new.enc")).toEqual(["bauflow/2026-07/old.enc"]);
});

it("never deletes the newest copy, even if every copy is old", () => {
  const objects = [
    { key: "bauflow/2026-01/a.enc", lastModified: at(300) },
    { key: "bauflow/2026-02/b.enc", lastModified: at(200) },
  ];
  expect(expiredBackupKeys(objects, now, 90, "bauflow/2026-11/missing.enc")).toEqual(["bauflow/2026-01/a.enc"]);
});

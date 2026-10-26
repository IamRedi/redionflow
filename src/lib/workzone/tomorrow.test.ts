import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { dayRange, isTomorrow } from "./date-utils";
it.each([
  ["2026-10-02T12:00:00Z", "2026-10-03", "2026-10-02T22:00:00Z"],
  ["2026-10-02T22:30:00Z", "2026-10-04", "2026-10-03T22:00:00Z"],
  ["2026-03-28T12:00:00Z", "2026-03-29", "2026-03-28T23:00:00Z"],
  ["2026-03-29T12:00:00Z", "2026-03-30", "2026-03-29T22:00:00Z"],
  ["2026-10-24T12:00:00Z", "2026-10-25", "2026-10-24T22:00:00Z"],
  ["2026-10-25T12:00:00Z", "2026-10-26", "2026-10-25T23:00:00Z"],
])("OR-01 %s has the same Berlin tomorrow under both host timezones", (instant, key, expected) => {
  for (const zone of ["UTC", "Europe/Berlin"]) {
    const clock = () => new Date(instant);
    const moduleUrl = pathToFileURL(path.resolve("src/lib/workzone/date-utils.ts")).href;
    const script = `import {isTomorrow,dateKey} from ${JSON.stringify(moduleUrl)};
      const now = new Date(${JSON.stringify(instant)});
      console.log(JSON.stringify({matches:isTomorrow(new Date(${JSON.stringify(expected)}),()=>now),today:dateKey(now),offset:now.getTimezoneOffset()}));`;
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { env: { ...process.env, TZ: zone }, encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    const result = JSON.parse(child.stdout) as { matches: boolean; today: string; offset: number };
    expect(result.matches).toBe(true);
    expect(result.today).toBe(instant === "2026-10-02T22:30:00Z" ? "2026-10-03" : instant.slice(0, 10));
    expect(result.offset).toBe(zone === "UTC" ? 0 : instant.startsWith("2026-03-28") || instant.startsWith("2026-10-25") ? -60 : -120);
    expect(dayRange(key).start.toISOString()).toBe(new Date(expected).toISOString());
    expect(isTomorrow(new Date(expected), clock)).toBe(true);
    expect(isTomorrow(new Date(new Date(expected).getTime() + 86_400_000), clock)).toBe(false);
  }
});
it.each([["2026-03-29", 23], ["2026-10-25", 25]])("OR-01 %s retains DST calendar boundaries", (key, hours) => {
  const range = dayRange(key as string);
  expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(hours);
});

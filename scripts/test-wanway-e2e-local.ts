import { spawn } from "node:child_process";

// Reuse the official disposable DB/port/storage/readiness contracts. Only the
// managed test webserver installs the provider mock after DB identity checks.
const child = spawn(process.execPath, ["--import", "tsx", "scripts/e2e-local.ts"], {
  env: { ...process.env, WANWAY_E2E_MOCK: "true" },
  stdio: "inherit",
});
child.on("error", () => process.exit(1));
child.on("exit", code => process.exit(code ?? 1));

import "dotenv/config";

export type AppEnv = "local" | "demo" | "production" | "saas";

function normalizeAppEnv(value: string | undefined): AppEnv {
  if (value === "demo" || value === "production" || value === "saas") return value;
  return "local";
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getDeploymentFlags() {
  const appEnv = normalizeAppEnv(process.env.APP_ENV);
  const demoMode = parseBoolean(process.env.DEMO_MODE);
  const demoResetAllowed = parseBoolean(process.env.DEMO_RESET_ALLOWED);

  return {
    appEnv,
    demoMode,
    demoResetAllowed,
  };
}

export function assertResetAllowed(scriptName: string) {
  const flags = getDeploymentFlags();

  if (flags.appEnv === "production" || flags.appEnv === "saas") {
    throw new Error(
      `[${scriptName}] blocked: APP_ENV=${flags.appEnv}. Destructive demo/local reset scripts must never run in production or SaaS.`,
    );
  }

  if (flags.appEnv === "demo" && (!flags.demoMode || !flags.demoResetAllowed)) {
    throw new Error(
      `[${scriptName}] blocked: demo reset requires DEMO_MODE=true and DEMO_RESET_ALLOWED=true.`,
    );
  }

  console.log(
    `[${scriptName}] env=${flags.appEnv} demoMode=${String(flags.demoMode)} demoResetAllowed=${String(flags.demoResetAllowed)}`,
  );
}

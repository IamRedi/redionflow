import { readSessionCookie } from "@/lib/auth/session-cookie";
import { cookies } from "next/headers";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import {
  describeDemoDisplayBootstrapGate,
  resolveDemoDisplayBootstrap,
} from "@/lib/auth/demo-display-bootstrap";

export const DISPLAY_COOKIE = "bk_display_id";

let bootstrapWarningLogged = false;

/**
 * BDF-P1-005: the previous `DEFAULT_DISPLAY_USERS` constant hard-coded
 * a single display user with PIN `303030`. That literal is gone. Any
 * email may now be a display login as long as the operator has
 * provisioned a STAFF user for it via the gated demo bootstrap below or
 * the admin display-management UI.
 */
export function isDisplayLoginEmail(email: string): boolean {
  const trimmed = String(email ?? "").trim();
  return trimmed.length > 0 && trimmed.includes("@");
}

/**
 * BDF-P1-005: strictly gated demo/local display bootstrap.
 *
 * Previously seeded `display@baumdienst.flow` with the literal PIN
 * `303030` and wrote it verbatim into `passwordHash`. That path is
 * removed. Under the gate defined by `resolveDemoDisplayBootstrap`
 * (`APP_ENV in {local, demo}` AND `ALLOW_DEMO_DISPLAY_BOOTSTRAP=true`
 * AND both `DEMO_DISPLAY_EMAIL` + `DEMO_DISPLAY_PASSWORD` set) this
 * function upserts one display user whose password is scrypt-hashed at
 * write time. In every other case (production, SaaS, missing flag,
 * missing credentials) the function is a safe no-op that logs one
 * operational warning.
 */
export async function ensureDefaultDisplayUsers(): Promise<void> {
  const bootstrap = resolveDemoDisplayBootstrap();
  if (!bootstrap) {
    if (!bootstrapWarningLogged) {
      bootstrapWarningLogged = true;
      console.info(
        `[auth] demo display bootstrap skipped (${describeDemoDisplayBootstrapGate()}); create display accounts via the admin UI to seed real users`,
      );
    }
    return;
  }

  try {
    const passwordHash = hashPassword(bootstrap.password);
    await prisma.user.upsert({
      where: { email: bootstrap.email },
      update: {
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
      create: {
        email: bootstrap.email,
        name: "Display View",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("[auth] ensureDefaultDisplayUsers failed", error);
    throw error;
  }
}

export async function getCurrentDisplayUser() {
  const jar = await cookies();
  const claims = readSessionCookie(jar.get(DISPLAY_COOKIE)?.value, "display");
  if (!claims) return null;

  try {
    return await prisma.user.findFirst({
      where: {
        id: claims.id,
        sessionEpoch: claims.epoch,
        role: "STAFF",
        isActive: true,
      },
    });
  } catch (error) {
    console.error("[auth] getCurrentDisplayUser failed", error);
    return null;
  }
}

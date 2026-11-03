/**
 * Worker login codes are 6 digits and must be unique among active workers:
 * the login form looks a worker up by name and code, and
 * `authenticateWorkerByCode` refuses a code that matches two accounts. So
 * the office and the worker's own profile both check here before saving.
 */

import { verifyPassword } from "@/lib/auth/password";

export function isValidLoginCode(code: string) {
  return /^\d{6}$/.test(code);
}

type CodeClient = {
  worker: {
    findMany: (args: {
      where: { status: "active"; loginCodeHash: { not: null }; id?: { not: string } };
      select: { loginCodeHash: true };
    }) => Promise<Array<{ loginCodeHash: string | null }>>;
  };
};

/** True when another active worker already signs in with this code. */
export async function isLoginCodeTaken(client: CodeClient, code: string, exceptWorkerId?: string) {
  const rows = await client.worker.findMany({
    where: { status: "active", loginCodeHash: { not: null }, ...(exceptWorkerId ? { id: { not: exceptWorkerId } } : {}) },
    select: { loginCodeHash: true },
  });
  return rows.some((row) => row.loginCodeHash !== null && verifyPassword(code, row.loginCodeHash));
}

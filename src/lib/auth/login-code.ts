/**
 * Worker login codes are 6 digits and must be unique among active workers
 * and active owner PINs (including explicitly transferred legacy codes):
 * the login form looks a worker up by name and code, and
 * `authenticateWorkerByCode` refuses a code that matches two accounts. So
 * the office and the worker's own profile both check here before saving.
 */

import { verifyPassword } from "@/lib/auth/password";

export function isValidLoginCode(code: string) {
  return /^\d{6}$/.test(code);
}

type CodeClient = {
  user: { findMany: (args:{where:{role:'ADMIN';isActive:true;isOwner:true;loginPinHash:{not:null}};select:{loginPinHash:true}})=>Promise<Array<{loginPinHash:string|null}>> };
  worker: {
    findMany: (args: {
      where: { status: "active"; loginCodeHash: { not: null }; id?: { not: string } };
      select: { loginCodeHash: true };
    }) => Promise<Array<{ loginCodeHash: string | null }>>;
  };
};

/** Owner codes remain reserved after their duplicate worker login is disabled. */
export async function isLoginCodeTaken(client: CodeClient, code: string, exceptWorkerId?: string) {
  const rows = await client.worker.findMany({
    where: { status: "active", loginCodeHash: { not: null }, ...(exceptWorkerId ? { id: { not: exceptWorkerId } } : {}) },
    select: { loginCodeHash: true },
  });
  if(rows.some((row) => row.loginCodeHash !== null && verifyPassword(code, row.loginCodeHash)))return true;
  const owners=await client.user.findMany({where:{role:'ADMIN',isActive:true,isOwner:true,loginPinHash:{not:null}},select:{loginPinHash:true}});
  return owners.some(row=>row.loginPinHash!==null&&verifyPassword(code,row.loginPinHash));
}

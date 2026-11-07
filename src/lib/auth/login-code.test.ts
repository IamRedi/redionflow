import { describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/password";

import { isLoginCodeTaken, isValidLoginCode } from "./login-code";

function client(rows: Array<{ id: string; loginCodeHash: string | null }>,owners:Array<{loginPinHash:string|null}>=[]) {
  return {
    user:{findMany:async()=>owners},
    worker: {
      findMany: async (args: { where: { id?: { not: string } } }) =>
        rows.filter((row) => row.id !== args.where.id?.not).map(({ loginCodeHash }) => ({ loginCodeHash })),
    },
  };
}

describe("worker login codes", () => {
  it("accepts exactly six digits", () => {
    expect(isValidLoginCode("204517")).toBe(true);
    expect(isValidLoginCode("20451")).toBe(false);
    expect(isValidLoginCode("20451a")).toBe(false);
  });

  it("finds a code another worker already uses, but not the worker's own", async () => {
    const db = client([
      { id: "a", loginCodeHash: hashPassword("111111") },
      { id: "b", loginCodeHash: hashPassword("222222") },
    ]);
    expect(await isLoginCodeTaken(db, "222222")).toBe(true);
    expect(await isLoginCodeTaken(db, "222222", "b")).toBe(false);
    expect(await isLoginCodeTaken(db, "333333")).toBe(false);
  });
  it('does not reissue a transferred owner code to a worker',async()=>{
    const db=client([],[{loginPinHash:hashPassword('473829')}]);
    expect(await isLoginCodeTaken(db,'473829','former-worker')).toBe(true);
    expect(await isLoginCodeTaken(db,'123456')).toBe(false);
  });
});

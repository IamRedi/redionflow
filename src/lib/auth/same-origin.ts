import { NextResponse } from "next/server";

/** Cookie-authenticated POST routes require an explicit, exact browser origin. */
export function rejectCrossOriginMutation(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const expected = new URL(process.env.APP_BASE_URL || request.url).origin;
    if (origin && origin !== "null" && new URL(origin).origin === origin && origin === expected) return null;
  } catch { /* Malformed configuration or Origin fails closed. */ }
  return NextResponse.json({ok:false as const,message:"Mutation origin denied."},{status:403});
}

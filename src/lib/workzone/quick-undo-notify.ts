import { after } from "next/server";
import { QUICK_UNDO_MS } from "./session-rules";

/** Work start/stop notices wait out the undo window: a tap reversed within it never reaches the boss. */
export function notifyUnlessUndone(stillValid: () => Promise<boolean>, send: () => Promise<unknown>) {
  const run = async () => {
    await new Promise((resolve) => setTimeout(resolve, QUICK_UNDO_MS + 1_000));
    if (await stillValid()) await send();
  };
  try {
    after(() => run().catch((error) => console.error("[work-notice]", error)));
  } catch {
    // Outside a request (scripts, tests): fire and forget.
    void run().catch((error) => console.error("[work-notice]", error));
  }
}

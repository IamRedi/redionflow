import { stripVTControlCharacters } from "node:util";

export const OWNED_E2E_READY_PATTERN = /^\[baumkalk-e2e\] owned Next listener ready$/m;
export const OWNED_E2E_READY = "[baumkalk-e2e] owned Next listener ready";

/** Consume only the stdout pipe of our own next start child, never HTTP readiness.
 * Locked Next emits this line from its server's listening handler. Build output
 * is a separate inherited stream and cannot open this gate.
 */
export function createOwnedNextReadiness(onReady: () => void) {
  let output = "";
  let ready = false;
  return (chunk: Buffer | string) => {
    if (ready) return;
    output += chunk.toString();
    const plain = stripVTControlCharacters(output);
    if (/(?:^|\n)\s*✓ Ready in [^\r\n]+(?:\r?\n)/.test(plain)) {
      ready = true;
      onReady();
    }
    // Retain enough for split lines/ANSI sequences without unbounded buffering.
    if (output.length > 32_768) output = output.slice(-16_384);
  };
}

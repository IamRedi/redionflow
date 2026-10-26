import { expect, it, vi } from "vitest";
import { createOwnedNextReadiness } from "../../../scripts/lib/e2e-readiness";

it("only the owned Next listening message opens readiness, including split ANSI stdout", () => {
  const ready = vi.fn();
  const observe = createOwnedNextReadiness(ready);
  observe("HTTP 200 / Starting / Compiled successfully / EADDRINUSE\n");
  expect(ready).not.toHaveBeenCalled();
  observe("\u001b[32m✓ Rea");
  observe("dy in 100ms\u001b[0m\n");
  expect(ready).toHaveBeenCalledTimes(1);
  observe("✓ Ready in 120ms\n");
  expect(ready).toHaveBeenCalledTimes(1);
});

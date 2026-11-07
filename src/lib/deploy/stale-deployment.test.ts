import { expect, it, vi } from "vitest";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";

import { isStaleDeploymentError, reloadOnStaleDeployment } from "./stale-deployment";

const fakeWindow = () => {
  const store = new Map<string, string>();
  return {
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as unknown as Storage,
    location: { reload: vi.fn() } as unknown as Location,
  };
};

it("recognises the error Next throws for an action from an older deployment", () => {
  expect(isStaleDeploymentError(new UnrecognizedActionError('Server Action "40ab" was not found on the server.'))).toBe(true);
  expect(isStaleDeploymentError(new Error('Server Action "40ab" was not found on the server. \nRead more'))).toBe(true);
  expect(isStaleDeploymentError(new Error("database down"))).toBe(false);
  expect(isStaleDeploymentError("text")).toBe(false);
});

it("reloads once, then not again within 30 seconds, so a real fault cannot loop", () => {
  const win = fakeWindow();
  const stale = new UnrecognizedActionError("x");
  expect(reloadOnStaleDeployment(stale, 1_000_000, win)).toBe(true);
  expect(reloadOnStaleDeployment(stale, 1_010_000, win)).toBe(false);
  expect(reloadOnStaleDeployment(stale, 1_031_000, win)).toBe(true);
  expect(win.location.reload).toHaveBeenCalledTimes(2);
});

it("ignores other errors", () => {
  const win = fakeWindow();
  expect(reloadOnStaleDeployment(new Error("boom"), 1, win)).toBe(false);
  expect(win.location.reload).not.toHaveBeenCalled();
});

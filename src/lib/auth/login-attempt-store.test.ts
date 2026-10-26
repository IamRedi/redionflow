import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InMemoryLoginAttemptStore,
  LIMITS,
  LOCK_MS,
  RETENTION_MS,
  WINDOW_MS,
} from "./login-attempt-store";

describe("InMemoryLoginAttemptStore (semantics shared with the Postgres adapter)", () => {
  let store: InMemoryLoginAttemptStore;

  beforeEach(() => {
    store = new InMemoryLoginAttemptStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initially allows every scope", async () => {
    expect(await store.ensureAllowed("admin", "k1")).toEqual({ ok: true });
    expect(await store.ensureAllowed("worker", "k1")).toEqual({ ok: true });
  });

  it("locks the client after LIMITS[scope] failed attempts", async () => {
    for (let i = 0; i < LIMITS.admin - 1; i++) {
      await store.registerFailed("admin", "k1");
    }
    // Not locked yet.
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(true);
    // The Nth failure locks the client.
    await store.registerFailed("admin", "k1");
    const check = await store.ensureAllowed("admin", "k1");
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
      expect(check.retryAfterSeconds).toBeLessThanOrEqual(Math.ceil(LOCK_MS / 1000));
    }
  });

  it("separate clientKeys do not affect each other", async () => {
    for (let i = 0; i < LIMITS.admin; i++) {
      await store.registerFailed("admin", "k1");
    }
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(false);
    expect((await store.ensureAllowed("admin", "k2")).ok).toBe(true);
  });

  it("separate scopes for the same client do not affect each other", async () => {
    for (let i = 0; i < LIMITS.admin; i++) {
      await store.registerFailed("admin", "k1");
    }
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(false);
    expect((await store.ensureAllowed("worker", "k1")).ok).toBe(true);
  });

  it("clear() releases the lock immediately", async () => {
    for (let i = 0; i < LIMITS.admin; i++) {
      await store.registerFailed("admin", "k1");
    }
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(false);
    await store.clear("admin", "k1");
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(true);
  });

  it("window expiry: attempts before WINDOW_MS ago do not count toward the threshold", async () => {
    for (let i = 0; i < LIMITS.admin - 1; i++) {
      await store.registerFailed("admin", "k1");
    }
    vi.advanceTimersByTime(WINDOW_MS + 1_000);
    // The next attempt is treated as the first-in-window; not enough to lock.
    await store.registerFailed("admin", "k1");
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(true);
  });

  it("lockout expiry: `ensureAllowed` returns ok after LOCK_MS", async () => {
    for (let i = 0; i < LIMITS.admin; i++) {
      await store.registerFailed("admin", "k1");
    }
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(false);
    vi.advanceTimersByTime(LOCK_MS + 1_000);
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(true);
  });

  it("cleanup() removes rows older than RETENTION_MS", async () => {
    await store.registerFailed("admin", "k1");
    // Fast-forward past retention window.
    vi.advanceTimersByTime(RETENTION_MS + 1_000);
    const { removed } = await store.cleanup();
    expect(removed).toBe(1);
    // Bucket is gone; the next check returns allowed.
    expect((await store.ensureAllowed("admin", "k1")).ok).toBe(true);
  });

  it("cleanup() does not remove fresh rows", async () => {
    await store.registerFailed("admin", "k1");
    const { removed } = await store.cleanup();
    expect(removed).toBe(0);
  });

  it("firstBoot scope shares the same threshold semantics", async () => {
    for (let i = 0; i < LIMITS.firstBoot; i++) {
      await store.registerFailed("firstBoot", "k1");
    }
    expect((await store.ensureAllowed("firstBoot", "k1")).ok).toBe(false);
  });

  it("signup scope locks after LIMITS.signup failed attempts", async () => {
    for (let i = 0; i < LIMITS.signup; i++) {
      await store.registerFailed("signup", "signup-k1");
    }
    expect((await store.ensureAllowed("signup", "signup-k1")).ok).toBe(false);
  });

  it("signup scope stays open under the ceiling", async () => {
    for (let i = 0; i < LIMITS.signup - 1; i++) {
      await store.registerFailed("signup", "signup-k2");
    }
    expect((await store.ensureAllowed("signup", "signup-k2")).ok).toBe(true);
  });

  it("assistant scope locks after LIMITS.assistant failed attempts", async () => {
    for (let i = 0; i < LIMITS.assistant; i++) {
      await store.registerFailed("assistant", "ai-k1");
    }
    expect((await store.ensureAllowed("assistant", "ai-k1")).ok).toBe(false);
  });

  it("assistant ceiling is higher than login scopes (chat needs headroom)", () => {
    // Doubles as a documentation test — if someone lowers `assistant`
    // below the auth ceilings, a live chat can lock up while a login
    // brute-force stays open.
    expect(LIMITS.assistant).toBeGreaterThan(LIMITS.admin);
    expect(LIMITS.assistant).toBeGreaterThan(LIMITS.worker);
  });
});

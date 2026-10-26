import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pendingTransport } from "../../../tests/storage/pending-transport";
let storage: typeof import("./object-storage");
let provider: ReturnType<typeof pendingTransport>;
const files = () => [new File(["Baumnummer,Art\n001,Eiche\n"], "trees.csv", { type: "text/csv" })];
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:1");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key-only");
  vi.stubEnv("CONTENT_SCANNER", "none");
  provider = pendingTransport(); vi.stubGlobal("fetch", provider.fetcher);
  storage = await import("./object-storage");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
it("OR-02 ambiguous upload failure cleans the predetermined keys and journal idempotently", async () => {
  const batch = storage.planPendingImport("company", "site", files());
  provider.failures.upload = true;
  await expect(storage.uploadPendingImport(batch, files())).rejects.toThrow("upload failed");
  expect(provider.objects.size).toBe(2);
  await storage.abortPendingImport(batch); await storage.abortPendingImport(batch);
  expect(provider.objects.size).toBe(0);
});
it("OR-02 cleanup outage retains a durable journal; expired recovery restores pre-import storage", async () => {
  const batch = storage.planPendingImport("company", "site", files());
  await storage.uploadPendingImport(batch, files());
  provider.failures.remove = true;
  await expect(storage.abortPendingImport(batch)).rejects.toThrow("delete failed");
  expect([...provider.objects.keys()].some(key => key.includes("pending-imports"))).toBe(true);
  provider.failures.remove = false;
  await storage.reconcilePendingImport(batch.id, async () => [], batch.expiresAt);
  await storage.reconcilePendingImport(batch.id, async () => [], batch.expiresAt);
  expect(provider.objects.size).toBe(0);
});
it("OR-02 recovery preserves committed references and refuses active batches", async () => {
  const batch = storage.planPendingImport("company", "site", files());
  await storage.uploadPendingImport(batch, files());
  const read = vi.fn(async () => storage.pendingImportReferences(batch));
  await expect(storage.reconcilePendingImport(batch.id, read, batch.expiresAt - 1)).rejects.toThrow("still active");
  expect(read).not.toHaveBeenCalled();
  await storage.reconcilePendingImport(batch.id, read, batch.expiresAt);
  expect(read).toHaveBeenCalledWith("company", "site");
  expect(provider.objects.size).toBe(1);
  expect([...provider.objects.keys()][0]).toContain("/site/");
});

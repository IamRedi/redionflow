import { expect, it, vi } from "vitest";
const disk = vi.hoisted(() => ({ rm: vi.fn() }));
vi.mock("node:fs/promises", () => ({ rm: disk.rm }));
import { deleteManagedFileByUrl } from "./object-storage";
it("rejects traversal outside uploads without touching disk", async () => {
  disk.rm.mockClear();
  await expect(deleteManagedFileByUrl("/uploads/../../package.json")).rejects.toThrow();
  expect(disk.rm).not.toHaveBeenCalled();
});
it("can remove an ordinary legacy synthetic upload", async () => {
  disk.rm.mockClear();
  await deleteManagedFileByUrl("/uploads/baustellen/synthetic/file.pdf");
  expect(disk.rm).toHaveBeenCalledWith(expect.stringContaining("/public/uploads/baustellen/synthetic/file.pdf"), { force: true });
});

it("refuses an attached foreign object even if metadata was forged", async () => {
  disk.rm.mockClear();
  await expect(deleteManagedFileByUrl("/uploads/baustellen/tenant-b/file.pdf", {scope:"baustelle-documents",entityId:"tenant-a"})).rejects.toThrow("another entity");
  expect(disk.rm).not.toHaveBeenCalled();
});

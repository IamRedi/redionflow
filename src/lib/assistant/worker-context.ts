import { readFile } from "node:fs/promises";
import path from "node:path";

export async function getWorkerAssistantContext() {
  const [assistantGuide, uiMap, permissionMatrix] = await Promise.all([
    readFile(path.join(process.cwd(), "docs", "assistant", "WORKER_ASSISTANT.md"), "utf8"),
    readFile(path.join(process.cwd(), "docs", "assistant", "WORKER_UI_MAP.md"), "utf8"),
    readFile(path.join(process.cwd(), "docs", "assistant", "WORKER_PERMISSION_MATRIX.md"), "utf8"),
  ]);

  return {
    assistantGuide,
    uiMap,
    permissionMatrix,
  };
}

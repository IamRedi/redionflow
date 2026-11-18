import { readFileSync } from 'node:fs';
import path from 'node:path';

let version: string | null | undefined;
/** Public build identifier, not a session, customer value or encryption key. */
export function appBuildVersion(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  if (version !== undefined) return version;
  try {
    const value = readFileSync(path.join(process.cwd(), '.next/BUILD_ID'), 'utf8').trim();
    version = /^[\w-]{1,128}$/.test(value) ? value : null;
  } catch { version = null; }
  return version;
}

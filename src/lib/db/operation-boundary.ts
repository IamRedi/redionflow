import { AsyncLocalStorage } from "node:async_hooks";

// Operation kind only: never stores a tenant ID, identity, DB client or connection.
const operations = new AsyncLocalStorage<"tenant" | "signup-bootstrap">();

export function runTenantOperation<T>(callback: () => Promise<T>): Promise<T> {
  return operations.run("tenant", callback);
}

export function assertSignupBootstrapAllowed() {
  if (operations.getStore()) throw new Error("Signup bootstrap cannot run inside a database operation.");
}

export function runSignupBootstrap<T>(callback: () => Promise<T>): Promise<T> {
  assertSignupBootstrapAllowed();
  return operations.run("signup-bootstrap", callback);
}

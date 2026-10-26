import { expect, it } from "vitest";
import { provisionLocalPilotRole } from "../../../scripts/lib/rls-pilot-db";

it.each([
  "postgresql://int:synthetic@remote.example.test/baumkalk_integration",
  "postgresql://int:synthetic@127.0.0.1/production",
  "postgresql://postgres:synthetic@127.0.0.1/baumkalk_integration",
  "postgresql://int:synthetic@127.0.0.1/baumkalk_integration?host=remote.example.test",
  "postgresql://int:synthetic@127.0.0.1/baumkalk_integration?sslkey=/synthetic/key",
  "postgresql://int:synthetic@127.0.0.1/baumkalk_integration?schema=public&schema=public",
])("provisioning rejects unsafe connection before connecting: %s", async url => {
  // Actual helper: no pg mock, no remote connection, no SQL or file reads.
  await expect(provisionLocalPilotRole(url)).rejects.toThrow("Refusing role provisioning");
});

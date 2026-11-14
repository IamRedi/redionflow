import { expect, it } from "vitest";
import { assertWorkshopSeedEnv } from "../../../scripts/lib/workshop-fixture-env";
const env = { DATABASE_URL: "postgresql://int:synthetic@127.0.0.1:55435/baumdemo_test?schema=public", APP_ENV: "demo", SAAS_MODE: "false" };
it("accepts only the dedicated disposable workshop seed identity", () => expect(() => assertWorkshopSeedEnv(env)).not.toThrow());
it.each([
  "postgresql://int:synthetic@remote.example.test:55435/baumdemo_test",
  "postgresql://int:synthetic@127.0.0.1:55435/production",
  "postgresql://int:synthetic@127.0.0.1:5432/baumdemo_test",
  "postgresql://postgres:synthetic@127.0.0.1:55435/baumdemo_test",
  "postgresql://int:synthetic@127.0.0.1:55435/baumdemo_test?host=remote.example.test",
  "postgresql://int:synthetic@127.0.0.1:55435/baumdemo_test?schema=other",
  "postgresql://int:synthetic@127.0.0.1:55435/baumdemo_test#fragment", "",
])("rejects unsafe fixture URL %s before a database can be imported", DATABASE_URL => expect(() => assertWorkshopSeedEnv({ ...env, DATABASE_URL })).toThrow("Disposable workshop fixture required"));
it.each([{APP_ENV:"production"},{SAAS_MODE:"true"}])("rejects production/SaaS seeding", change => expect(() => assertWorkshopSeedEnv({...env,...change})).toThrow());

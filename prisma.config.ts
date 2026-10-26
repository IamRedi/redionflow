import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl ?? env("DATABASE_URL"),
  },
});


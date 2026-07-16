import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: path.join(rootDir, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env (not env()) so `prisma generate` works without a live DB
    url: process.env.DATABASE_URL,
  },
});

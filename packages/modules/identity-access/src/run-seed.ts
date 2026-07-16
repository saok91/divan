/**
 * Dev seed CLI — owned by @divan/identity-access.
 * Guarded: NODE_ENV !== production AND ALLOW_DEV_SEED=true.
 *
 * Usage (from repo root):
 *   ALLOW_DEV_SEED=true pnpm db:seed
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { createPrismaClient } from "@divan/db";

import {
  DEV_SEED_PASSWORD,
  SEED_ACCOUNTS,
  seedDevAccounts,
} from "./index";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
loadEnv({ path: path.join(rootDir, ".env") });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is required to seed");
  }

  const db = createPrismaClient(url);
  try {
    const result = await seedDevAccounts(db);
    console.log(
      `Seeded ${result.createdOrUpdated} accounts (password: ${DEV_SEED_PASSWORD})`,
    );
    for (const a of SEED_ACCOUNTS) {
      console.log(`  - ${a.username} → ${a.coarseRole}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

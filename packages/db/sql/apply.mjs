/**
 * Apply kernel raw SQL migrations in packages/db/sql (lexical order).
 * Usage: DATABASE_URL=... node packages/db/sql/apply.mjs
 * Or: pnpm --filter @divan/db sql:apply  (loads repo-root .env when present)
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadRootEnv() {
  try {
    const { config } = await import("dotenv");
    const rootEnv = resolve(__dirname, "../../../.env");
    config({ path: rootEnv });
  } catch {
    // dotenv optional when DATABASE_URL already set
  }
}

async function main() {
  await loadRootEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const files = (await readdir(__dirname))
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log("No SQL migrations found.");
    return;
  }

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readFile(join(__dirname, file), "utf8");
      console.log(`Applying ${file}…`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`  ok: ${file}`);
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // keep original apply error
        }
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

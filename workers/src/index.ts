/**
 * pg-boss worker bootstrap — temporal.recalculate (Story 4.4 / AD-6 / 11.1).
 *
 * Start: DATABASE_URL=... pnpm --filter @divan/workers start
 * Or import `startWorkers()` from app bootstrap.
 *
 * Local UAT: same DATABASE_URL as web. On boot, reclaimPendingRecalculations
 * re-enqueues pending|failed|stale rows (does not clear status). Banner clears
 * only after runHistoricalRecalculation succeeds. Log when N > 0:
 * `[workers] reclaimed N pending/failed/stale recalc job(s)`
 */

import { createPgPool, type Pool } from "@divan/db";
import {
  TEMPORAL_RECALCULATE_QUEUE,
  listPendingRecalculationJobs,
  runHistoricalRecalculation,
  setRecalcEnqueue,
  type RecalcJobPayload,
} from "@divan/person-employment";
import { PgBoss } from "pg-boss";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { startRecoveryLoop } from "./recovery-loop";

/** Kept for tests that need to assert stub mode was the pre-4.4 default. */
export const WORKERS_STUB = false as const;

export type WorkersHandle = {
  boss: PgBoss;
  stop: () => Promise<void>;
};

async function sendRecalcJob(
  boss: PgBoss,
  payload: RecalcJobPayload,
): Promise<void> {
  await boss.send(TEMPORAL_RECALCULATE_QUEUE, payload, {
    // Per-generation key: newer bumps must not be dropped by an older singleton.
    singletonKey: `person:${payload.personId}:g${payload.generation}`,
    singletonSeconds: 60,
  });
}

/**
 * Re-send durable pending/failed/stale rows (orphan after API crash or missing send).
 * Blocking set matches getPlatformRecalcSignal. Reclaim only enqueues; status
 * clears when the worker handler finishes runHistoricalRecalculation.
 */
export async function reclaimPendingRecalculations(
  boss: PgBoss,
  db: Pool,
  options?: { afterPersonId?: string; onEnqueued?: (personId: string) => void },
): Promise<number> {
  const pending = await listPendingRecalculationJobs(db, options?.afterPersonId);
  for (const payload of pending) {
    await sendRecalcJob(boss, payload);
    options?.onEnqueued?.(payload.personId);
  }
  return pending.length;
}

/**
 * Boot pg-boss, create queue, register idempotent handler, wire domain enqueue port.
 */
export async function startWorkers(
  connectionString: string = process.env.DATABASE_URL?.trim() ?? "",
): Promise<WorkersHandle> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to start workers");
  }

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => {
    console.error("[workers] pg-boss error", err.name);
  });

  const pool = createPgPool(connectionString);
  let stopRecovery: (() => Promise<void>) | undefined;
  let afterPersonId: string | undefined;
  try {
    await boss.start();
    await boss.createQueue(TEMPORAL_RECALCULATE_QUEUE, {
      policy: "singleton",
    });

    setRecalcEnqueue(async (payload: RecalcJobPayload) => {
      await sendRecalcJob(boss, payload);
    });

    await boss.work<RecalcJobPayload>(
      TEMPORAL_RECALCULATE_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const data = job.data;
          if (
            !data?.personId ||
            !data.fromEffectiveDate ||
            data.generation == null
          ) {
            throw new Error(
              `invalid temporal.recalculate payload job=${job.id}`,
            );
          }
          await runHistoricalRecalculation(pool, data);
        }
      },
    );

    stopRecovery = startRecoveryLoop(async () => {
      // Keyset cursor prevents a batch of permanently failing rows starving others.
      const reclaimed = await reclaimPendingRecalculations(boss, pool, {
        afterPersonId,
        onEnqueued: (personId) => { afterPersonId = personId; },
      });
      if (reclaimed < 100) afterPersonId = undefined;
      if (reclaimed > 0) console.log(`[workers] reclaimed ${reclaimed} pending/failed/stale recalc job(s)`);
    }, { onError: () => console.error("[workers] recovery failed; durable rows will be retried") });
    let shutdown: Promise<void> | undefined;
    return {
      boss,
      stop: () => {
        shutdown ??= (async () => {
          setRecalcEnqueue(null);
          await stopRecovery?.();
          try {
            await boss.stop({ graceful: true, timeout: 10_000 });
          } finally {
            await pool.end();
          }
        })();
        return shutdown;
      },
    };
  } catch (error) {
    await stopRecovery?.();
    setRecalcEnqueue(null);
    await boss.stop({ graceful: false }).catch(() => undefined);
    await pool.end().catch(() => undefined);
    throw error;
  }
}

/** CLI entry when run as main module. */
export async function main(): Promise<void> {
  loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });
  const handle = await startWorkers();
  console.log(
    `[workers] listening on queue ${TEMPORAL_RECALCULATE_QUEUE} (stub=${WORKERS_STUB})`,
  );
  const shutdown = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("workers/src/index.ts") ||
    process.argv[1].endsWith("workers\\src\\index.ts") ||
    process.argv[1].includes("@divan/workers"));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

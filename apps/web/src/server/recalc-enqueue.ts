/**
 * Send-only pg-boss port for the Next.js API process (Story 4.4 / AD-6).
 * Workers own `work()` + reclaim; this process only `send`s after commit.
 */

import {
  TEMPORAL_RECALCULATE_QUEUE,
  setRecalcEnqueue,
  type RecalcJobPayload,
} from "@divan/person-employment";
import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;
let ready: Promise<void> | null = null;

/**
 * Idempotent: register production enqueue so finalize/lifecycle post-commit
 * sends actually hit `temporal.recalculate`.
 */
export async function ensureRecalcEnqueueRegistered(
  connectionString: string = process.env.DATABASE_URL?.trim() ?? "",
): Promise<void> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to register recalc enqueue");
  }
  if (ready) {
    await ready;
    return;
  }
  ready = (async () => {
    const instance = new PgBoss(connectionString);
    instance.on("error", (err) => {
      console.error("[web] pg-boss enqueue error", err);
    });
    await instance.start();
    await instance.createQueue(TEMPORAL_RECALCULATE_QUEUE, {
      policy: "singleton",
    });
    setRecalcEnqueue(async (payload: RecalcJobPayload) => {
      await instance.send(TEMPORAL_RECALCULATE_QUEUE, payload, {
        // Per-generation key so bumps are not coalesced away from an older job.
        singletonKey: `person:${payload.personId}:g${payload.generation}`,
        singletonSeconds: 60,
      });
    });
    boss = instance;
  })();
  try {
    await ready;
  } catch (err) {
    ready = null;
    boss = null;
    setRecalcEnqueue(null);
    throw err;
  }
}

/** Test / shutdown hook. */
export async function stopRecalcEnqueue(): Promise<void> {
  setRecalcEnqueue(null);
  if (boss) {
    await boss.stop({ graceful: true, timeout: 5_000 });
    boss = null;
  }
  ready = null;
}

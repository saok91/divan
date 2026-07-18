/**
 * Platform ops status — recalc pending / stale (Story 4.4 / UX-DR5).
 * Separate from `me` session identity so ops signals do not dilute authz fields.
 */

import { createPgPool } from "@divan/db";
import { getPlatformRecalcSignal } from "@divan/person-employment";

import { ensureRecalcEnqueueRegistered } from "./recalc-enqueue";
import { createTRPCRouter, protectedProcedure } from "./trpc";

let statusPool: ReturnType<typeof createPgPool> | null = null;

function getStatusPool() {
  if (statusPool) return statusPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for platform status");
  }
  statusPool = createPgPool(url);
  return statusPool;
}

export const platformStatusRouter = createTRPCRouter({
  /** Durable AD-6 recalc signal — drives StaleRecalcBanner + gold CTA block. */
  recalc: protectedProcedure.query(async () => {
    try {
      await ensureRecalcEnqueueRegistered();
      const signal = await getPlatformRecalcSignal(getStatusPool());
      return signal;
    } catch {
      // Fail closed: unknown freshness → block gold CTAs (never silent clear).
      return {
        recalculationPending: true,
        blockingStale: true,
        stalePendingUntil: "00:00",
      };
    }
  }),
});

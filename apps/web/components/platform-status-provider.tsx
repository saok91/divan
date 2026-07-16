"use client";

import * as React from "react";

export type BreakGlassGrant = {
  active: boolean;
  /** ISO timestamp; when past, grant is expired and banner may dismiss. */
  expiresAt: string | null;
};

export type PlatformStatus = {
  /** AD-6 UI contract — real recalc jobs land in Epic 4. */
  recalculationPending: boolean;
  /** Blocking stale derived state — disables gold finalize/export/report CTAs. */
  blockingStale: boolean;
  /** Sample pending-until clock for operational copy (HH:mm, Latin digits ok). */
  stalePendingUntil: string;
  breakGlass: BreakGlassGrant;
};

type PlatformStatusContextValue = PlatformStatus & {
  setRecalculationPending: (value: boolean) => void;
  setBlockingStale: (value: boolean) => void;
  setStalePendingUntil: (value: string) => void;
  setBreakGlass: (value: BreakGlassGrant) => void;
  /** True while blocking stale / recalc pending — Epic 4–6 gold CTA gate. */
  isGoldCtaBlocked: boolean;
  /** Break-glass grant still within expiry window. */
  isBreakGlassLive: boolean;
};

const PlatformStatusContext =
  React.createContext<PlatformStatusContextValue | null>(null);

const DEFAULT_STATUS: PlatformStatus = {
  recalculationPending: false,
  blockingStale: false,
  stalePendingUntil: "09:14",
  breakGlass: { active: false, expiresAt: null },
};

function isGrantLive(grant: BreakGlassGrant, nowMs: number): boolean {
  if (!grant.active) return false;
  if (!grant.expiresAt) return true;
  const expires = Date.parse(grant.expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires > nowMs;
}

export function PlatformStatusProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<PlatformStatus>;
}) {
  const [recalculationPending, setRecalculationPending] = React.useState(
    initial?.recalculationPending ?? DEFAULT_STATUS.recalculationPending,
  );
  const [blockingStale, setBlockingStale] = React.useState(
    initial?.blockingStale ?? DEFAULT_STATUS.blockingStale,
  );
  const [stalePendingUntil, setStalePendingUntil] = React.useState(
    initial?.stalePendingUntil ?? DEFAULT_STATUS.stalePendingUntil,
  );
  const [breakGlass, setBreakGlass] = React.useState<BreakGlassGrant>(
    initial?.breakGlass ?? DEFAULT_STATUS.breakGlass,
  );
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!breakGlass.active || !breakGlass.expiresAt) return;
    const expires = Date.parse(breakGlass.expiresAt);
    if (Number.isNaN(expires)) return;

    function refreshNow() {
      setNowMs(Date.now());
    }

    const delay = Math.max(0, expires - Date.now());
    const id = window.setTimeout(refreshNow, delay + 10);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, [breakGlass.active, breakGlass.expiresAt]);

  const isBreakGlassLive = isGrantLive(breakGlass, nowMs);
  const isGoldCtaBlocked = blockingStale || recalculationPending;

  const value = React.useMemo<PlatformStatusContextValue>(
    () => ({
      recalculationPending,
      blockingStale,
      stalePendingUntil,
      breakGlass,
      setRecalculationPending,
      setBlockingStale,
      setStalePendingUntil,
      setBreakGlass,
      isGoldCtaBlocked,
      isBreakGlassLive,
    }),
    [
      recalculationPending,
      blockingStale,
      stalePendingUntil,
      breakGlass,
      isGoldCtaBlocked,
      isBreakGlassLive,
    ],
  );

  return (
    <PlatformStatusContext.Provider value={value}>
      {children}
    </PlatformStatusContext.Provider>
  );
}

export function usePlatformStatus(): PlatformStatusContextValue {
  const ctx = React.useContext(PlatformStatusContext);
  if (!ctx) {
    throw new Error(
      "usePlatformStatus must be used within PlatformStatusProvider",
    );
  }
  return ctx;
}

/** Hook for Epic 4–6 gold CTAs — true while blocking stale/recalc. */
export function useStaleBlocking(): {
  isGoldCtaBlocked: boolean;
  blockingStale: boolean;
  recalculationPending: boolean;
} {
  const { isGoldCtaBlocked, blockingStale, recalculationPending } =
    usePlatformStatus();
  return { isGoldCtaBlocked, blockingStale, recalculationPending };
}

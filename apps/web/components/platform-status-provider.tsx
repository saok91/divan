"use client";

import * as React from "react";

import { api } from "@/lib/trpc/client";

export type BreakGlassGrant = {
  active: boolean;
  /** ISO timestamp; required when active for a live real grant. */
  expiresAt: string | null;
  incidentId?: string | null;
  grantId?: string | null;
};

export type PlatformStatus = {
  /** AD-6 UI contract — real recalc jobs land in Epic 4. */
  recalculationPending: boolean;
  /** Blocking stale derived state — disables gold finalize/export/report CTAs. */
  blockingStale: boolean;
  /**
   * Ops/debug sample clock — never render as a UI deadline (Story 8.9).
   */
  stalePendingUntil: string;
  /** Distinct persons pending/failed/stale — banner N; null = unknown. */
  affectedPersonCount: number | null;
  breakGlass: BreakGlassGrant;
  /**
   * Mid-session authz change (Story 2.6) — distinct from stale-banner (FR-45).
   */
  authzChanged: boolean;
  /**
   * Demo draft stand-in for Epic 4 Draft forms — proves save/discard + block finalize.
   */
  demoDraftOpen: boolean;
  /** After Save Draft CTA — stand-in persisted flag (Epic 4 seam). */
  demoDraftSaved: boolean;
};

type PlatformStatusContextValue = PlatformStatus & {
  setRecalculationPending: (value: boolean) => void;
  setBlockingStale: (value: boolean) => void;
  setStalePendingUntil: (value: string) => void;
  setAffectedPersonCount: (value: number | null) => void;
  setBreakGlass: (value: BreakGlassGrant) => void;
  setAuthzChanged: (value: boolean) => void;
  clearAuthzChanged: () => void;
  setDemoDraftOpen: (value: boolean) => void;
  setDemoDraftSaved: (value: boolean) => void;
  /**
   * Real Draft save handler registered by فرم رویداد (Story 4.2).
   * Authz modal calls this instead of a pure demo flag flip when present.
   */
  registerPersonnelDraftSaveHandler: (
    handler: (() => Promise<boolean>) | null,
  ) => void;
  runPersonnelDraftSave: () => Promise<boolean>;
  /** True while blocking stale / recalc / authz-change — gold CTA gate. */
  isGoldCtaBlocked: boolean;
  /** Break-glass grant still within expiry window (requires finite future expiresAt). */
  isBreakGlassLive: boolean;
  /** Finalize blocked while authz-changed modal is active (Story 2.6). */
  isFinalizeBlockedByAuthzChange: boolean;
  /**
   * Mid-session authz change blocks sensitive mutations (finalize + lifecycle)
   * until the operator acknowledges — same spirit, separate from finalize permission.
   */
  isMutationBlockedByAuthzChange: boolean;
};

const PlatformStatusContext =
  React.createContext<PlatformStatusContextValue | null>(null);

const DEFAULT_STATUS: PlatformStatus = {
  recalculationPending: false,
  blockingStale: false,
  stalePendingUntil: "09:14",
  affectedPersonCount: 0,
  breakGlass: { active: false, expiresAt: null },
  authzChanged: false,
  demoDraftOpen: false,
  demoDraftSaved: false,
};

/**
 * Live break-glass requires active + finite future expiresAt.
 * Forever-live (`active` + `expiresAt: null`) is no longer valid for real grants.
 */
function isGrantLive(grant: BreakGlassGrant, nowMs: number): boolean {
  if (!grant.active) return false;
  if (!grant.expiresAt) return false;
  const expires = Date.parse(grant.expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires > nowMs;
}

function toBreakGlassGrant(
  value: BreakGlassGrant | undefined | null,
): BreakGlassGrant {
  if (!value) return DEFAULT_STATUS.breakGlass;
  return {
    active: value.active,
    expiresAt: value.expiresAt,
    incidentId: value.incidentId ?? null,
    grantId: value.grantId ?? null,
  };
}

export function PlatformStatusProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<PlatformStatus>;
}) {
  const initialAuthzChanged = initial?.authzChanged ?? false;

  // Mid-session sync: poll fresh session (breakGlass + authzChanged).
  const meQuery = api.me.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // AD-6 / UX-DR5: durable recalc pending/stale from server (not demo-only toggle).
  const recalcQuery = api.platformStatus.recalc.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const serverRecalcPending = recalcQuery.data?.recalculationPending === true;
  const serverBlockingStale = recalcQuery.data?.blockingStale === true;
  const serverStalePendingUntil = recalcQuery.data?.stalePendingUntil;
  const serverAffectedPersonCount = recalcQuery.data?.affectedPersonCount;

  // Local/demo toggles OR with server — server is source of truth for production pending.
  const [recalculationPendingLocal, setRecalculationPending] = React.useState(
    initial?.recalculationPending ?? DEFAULT_STATUS.recalculationPending,
  );
  const [blockingStaleLocal, setBlockingStale] = React.useState(
    initial?.blockingStale ?? DEFAULT_STATUS.blockingStale,
  );
  const [stalePendingUntil, setStalePendingUntil] = React.useState(
    initial?.stalePendingUntil ?? DEFAULT_STATUS.stalePendingUntil,
  );
  const [affectedPersonCountLocal, setAffectedPersonCount] = React.useState(
    initial?.affectedPersonCount ?? DEFAULT_STATUS.affectedPersonCount,
  );

  React.useEffect(() => {
    if (serverStalePendingUntil) {
      setStalePendingUntil(serverStalePendingUntil);
    }
  }, [serverStalePendingUntil]);

  React.useEffect(() => {
    if (serverAffectedPersonCount === null) {
      setAffectedPersonCount(null);
      return;
    }
    if (typeof serverAffectedPersonCount === "number") {
      setAffectedPersonCount(serverAffectedPersonCount);
    }
  }, [serverAffectedPersonCount]);

  const recalculationPending =
    serverRecalcPending || recalculationPendingLocal;
  const blockingStale = serverBlockingStale || blockingStaleLocal;
  // Gallery demo owns N while local pending is on; otherwise prefer server
  // (including null = unknown). Never Math.max — leftover demo N must not inflate.
  const affectedPersonCount: number | null = recalculationPendingLocal
    ? affectedPersonCountLocal
    : serverAffectedPersonCount !== undefined
      ? serverAffectedPersonCount
      : affectedPersonCountLocal;

  const [breakGlassOverride, setBreakGlassOverride] =
    React.useState<BreakGlassGrant | null>(null);
  const [authzChangedAcked, setAuthzChangedAcked] = React.useState(false);
  const [demoDraftOpen, setDemoDraftOpen] = React.useState(
    initial?.demoDraftOpen ?? false,
  );
  const [demoDraftSaved, setDemoDraftSaved] = React.useState(
    initial?.demoDraftSaved ?? false,
  );
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const personnelDraftSaveRef = React.useRef<
    (() => Promise<boolean>) | null
  >(null);

  const registerPersonnelDraftSaveHandler = React.useCallback(
    (handler: (() => Promise<boolean>) | null) => {
      personnelDraftSaveRef.current = handler;
    },
    [],
  );

  const runPersonnelDraftSave = React.useCallback(async () => {
    const fn = personnelDraftSaveRef.current;
    if (!fn) {
      setDemoDraftSaved(true);
      return true;
    }
    return fn();
  }, []);

  const breakGlass = toBreakGlassGrant(
    breakGlassOverride ??
      meQuery.data?.breakGlass ??
      initial?.breakGlass ??
      DEFAULT_STATUS.breakGlass,
  );

  // Prefer live me once loaded; do not sticky-OR SSR forever.
  const authzChangedFromServer =
    meQuery.data !== undefined
      ? meQuery.data.authzChanged === true
      : initialAuthzChanged;

  // Re-open modal only on a rising edge (false→true), not while stale me is true after ack.
  const prevServerChangedRef = React.useRef(authzChangedFromServer);
  React.useEffect(() => {
    if (authzChangedFromServer && !prevServerChangedRef.current) {
      setAuthzChangedAcked(false);
    }
    prevServerChangedRef.current = authzChangedFromServer;
  }, [authzChangedFromServer]);

  const authzChanged = authzChangedFromServer && !authzChangedAcked;

  React.useEffect(() => {
    if (!breakGlass.active || !breakGlass.expiresAt) return;
    const expires = DateParseSafe(breakGlass.expiresAt);
    if (expires === null) return;

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
  const isFinalizeBlockedByAuthzChange = authzChanged;
  const isMutationBlockedByAuthzChange = authzChanged;
  const isGoldCtaBlocked =
    blockingStale || recalculationPending || isFinalizeBlockedByAuthzChange;

  const setBreakGlass = React.useCallback((value: BreakGlassGrant) => {
    setBreakGlassOverride(toBreakGlassGrant(value));
  }, []);

  const setAuthzChanged = React.useCallback((value: boolean) => {
    if (value) {
      setAuthzChangedAcked(false);
    } else {
      setAuthzChangedAcked(true);
    }
  }, []);

  const clearAuthzChanged = React.useCallback(() => {
    setAuthzChangedAcked(true);
  }, []);

  const value = React.useMemo<PlatformStatusContextValue>(
    () => ({
      recalculationPending,
      blockingStale,
      stalePendingUntil,
      affectedPersonCount,
      breakGlass,
      authzChanged,
      demoDraftOpen,
      demoDraftSaved,
      setRecalculationPending,
      setBlockingStale,
      setStalePendingUntil,
      setAffectedPersonCount,
      setBreakGlass,
      setAuthzChanged,
      clearAuthzChanged,
      setDemoDraftOpen,
      setDemoDraftSaved,
      registerPersonnelDraftSaveHandler,
      runPersonnelDraftSave,
      isGoldCtaBlocked,
      isBreakGlassLive,
      isFinalizeBlockedByAuthzChange,
      isMutationBlockedByAuthzChange,
    }),
    [
      recalculationPending,
      blockingStale,
      stalePendingUntil,
      affectedPersonCount,
      breakGlass,
      authzChanged,
      demoDraftOpen,
      demoDraftSaved,
      setBreakGlass,
      setAuthzChanged,
      clearAuthzChanged,
      registerPersonnelDraftSaveHandler,
      runPersonnelDraftSave,
      isGoldCtaBlocked,
      isBreakGlassLive,
      isFinalizeBlockedByAuthzChange,
      isMutationBlockedByAuthzChange,
    ],
  );

  return (
    <PlatformStatusContext.Provider value={value}>
      {children}
    </PlatformStatusContext.Provider>
  );
}

function DateParseSafe(iso: string): number | null {
  const expires = Date.parse(iso);
  return Number.isNaN(expires) ? null : expires;
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

/** Hook for Epic 4–6 gold CTAs — true while blocking stale/recalc OR authz change. */
export function useStaleBlocking(): {
  isGoldCtaBlocked: boolean;
  blockingStale: boolean;
  recalculationPending: boolean;
} {
  const { isGoldCtaBlocked, blockingStale, recalculationPending } =
    usePlatformStatus();
  return {
    isGoldCtaBlocked,
    blockingStale,
    recalculationPending,
  };
}

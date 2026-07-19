/**
 * Sidebar collapse preference storage.
 * Per-account key `divan-sidebar-collapsed:<accountId>` with `"true"` | `"false"`.
 * Default (missing / unreadable) = expanded (not collapsed).
 */

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "divan-sidebar-collapsed";

const listeners = new Set<() => void>();

function emitSidebarCollapsedChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function accountSidebarCollapsedStorageKey(accountId: string): string {
  return `${SIDEBAR_COLLAPSED_STORAGE_KEY}:${accountId}`;
}

/** Read collapsed preference. Fail open to expanded (`false`). */
export function readSidebarCollapsed(accountId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(
      accountSidebarCollapsedStorageKey(accountId),
    );
    if (raw === "true") return true;
    if (raw === "false") return false;
    return false;
  } catch {
    return false;
  }
}

/** Persist collapsed preference and notify same-tab subscribers. */
export function writeSidebarCollapsed(
  accountId: string,
  collapsed: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      accountSidebarCollapsedStorageKey(accountId),
      collapsed ? "true" : "false",
    );
  } catch {
    // fail open — preference not persisted
  }
  emitSidebarCollapsedChange();
}

/**
 * Subscribe to collapse preference changes (same-tab writes + cross-tab storage).
 * For use with `useSyncExternalStore`.
 */
export function subscribeSidebarCollapsed(
  accountId: string,
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange);
  const key = accountSidebarCollapsedStorageKey(accountId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      onStoreChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

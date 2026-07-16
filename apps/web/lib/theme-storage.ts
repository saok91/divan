/**
 * Theme preference storage.
 *
 * Anonymous sessions: next-themes persists to localStorage (key `divan-theme`).
 * Authenticated sessions: per-account key `divan-theme:<accountId>`.
 */
export const THEME_STORAGE_KEY = "divan-theme";

export function accountThemeStorageKey(accountId: string): string {
  return `${THEME_STORAGE_KEY}:${accountId}`;
}

export type ThemePreferenceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Default anonymous fallback — localStorage via next-themes. */
export function createAnonymousThemeStorage(): ThemePreferenceStorage {
  return {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
    },
  };
}

/** Per-account localStorage adapter keyed by account id. */
export function createAccountThemeStorage(
  accountId: string,
): ThemePreferenceStorage {
  const scopedKey = accountThemeStorageKey(accountId);
  return {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      if (key === THEME_STORAGE_KEY || key === scopedKey) {
        return window.localStorage.getItem(scopedKey);
      }
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      if (key === THEME_STORAGE_KEY || key === scopedKey) {
        window.localStorage.setItem(scopedKey, value);
        return;
      }
      window.localStorage.setItem(key, value);
    },
  };
}

/**
 * Resolve theme storage for anonymous or signed-in account.
 */
export function resolveThemeStorage(
  accountId?: string | null,
): ThemePreferenceStorage {
  if (accountId) {
    return createAccountThemeStorage(accountId);
  }
  return createAnonymousThemeStorage();
}

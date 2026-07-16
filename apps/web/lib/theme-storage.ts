/**
 * Theme preference storage.
 *
 * Anonymous sessions: next-themes persists to localStorage (key `divan-theme`).
 *
 * Story 1.4 extension point — when an authenticated session exists, replace the
 * storage adapter to read/write per-account preference (e.g. keyed by user id).
 * Do not invent auth/DB theme columns here.
 */
export const THEME_STORAGE_KEY = "divan-theme";

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

/**
 * Story 1.4: swap this factory to bind storage to the signed-in account id.
 * Example shape (do not implement yet):
 *   createAccountThemeStorage(userId: string): ThemePreferenceStorage
 */
export function resolveThemeStorage(accountId?: string | null): ThemePreferenceStorage {
  void accountId;
  // Authenticated per-account persistence lands in Story 1.4.
  return createAnonymousThemeStorage();
}

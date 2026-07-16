"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import {
  THEME_STORAGE_KEY,
  resolveThemeStorage,
} from "@/lib/theme-storage";

/**
 * Per-account theme preference via resolveThemeStorage(accountId).
 * Restore only when the signed-in account changes — never on toggle.
 * Also mirrors into the next-themes global key so provider state stays aligned.
 */
export function AccountThemeSync({ accountId }: { accountId: string }) {
  const { theme, setTheme } = useTheme();
  const persistEnabled = useRef(false);

  useEffect(() => {
    persistEnabled.current = false;
    const storage = resolveThemeStorage(accountId);
    try {
      const stored = storage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      }
    } catch {
      // ignore quota / private mode
    }
    const timer = window.setTimeout(() => {
      persistEnabled.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
    // setTheme omitted on purpose: next-themes may change its identity and
    // must not re-trigger restore (that reverted the light/dark toggle).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accountId only
  }, [accountId]);

  useEffect(() => {
    if (!persistEnabled.current) return;
    if (theme !== "light" && theme !== "dark") return;
    const storage = resolveThemeStorage(accountId);
    try {
      storage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [accountId, theme]);

  return null;
}

"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeToggleProps = React.ComponentProps<"button">;

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * In-place theme swap only — no navigation, no unsaved-form guards.
 * Focus stays on the control after toggle (native button retains focus).
 */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  function ThemeToggle({ className, onClick, ...props }, ref) {
    const { resolvedTheme, setTheme } = useTheme();
    const isClient = useIsClient();

    const isDark = isClient && resolvedTheme === "dark";
    const label = isDark ? "تغییر به حالت روشن" : "تغییر به حالت تاریک";

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-body-medium text-chrome-foreground focus-ring-chrome",
          "hover:bg-sidebar-active-background",
          className,
        )}
        aria-label={label}
        title={label}
        {...props}
        onClick={(event) => {
          // Class swap on <html> via next-themes — no router.push, no dirty checks.
          setTheme(isDark ? "light" : "dark");
          onClick?.(event);
        }}
      >
        {isClient ? (
          isDark ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )
        ) : (
          <span className="size-4" aria-hidden />
        )}
        <span>پوسته</span>
      </button>
    );
  },
);

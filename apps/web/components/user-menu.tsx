"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/lib/logout-action";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  className?: string;
  userLabel: string;
  accountId: string;
};

/**
 * Shell chrome user menu — identity label, theme toggle, logout.
 */
export function UserMenu({ className, userLabel, accountId }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!rootRef.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  function onLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onBlur={onBlur}
      data-account-id={accountId}
    >
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 items-center rounded-md px-3 text-body-medium text-chrome-foreground hover:bg-sidebar-active-background focus-ring-chrome"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {userLabel}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 min-w-48 rounded-md border border-white/10 bg-chrome p-2 shadow-md"
        >
          <div role="none" className="px-1 py-1">
            <ThemeToggle role="menuitem" />
          </div>
          <div role="none" className="border-t border-white/10 px-1 py-1">
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-start text-body-medium text-chrome-foreground hover:bg-sidebar-active-background disabled:opacity-50"
              onClick={onLogout}
            >
              خروج
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

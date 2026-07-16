"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/lib/logout-action";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  className?: string;
  userLabel: string;
  accountId: string;
};

function focusAdjacentTabbable(
  from: HTMLElement,
  direction: 1 | -1,
): void {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(selector),
  ).filter((el) => {
    if (el.closest("[hidden]")) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  });
  const index = nodes.indexOf(from);
  if (index < 0) return;
  const next = nodes[index + direction];
  next?.focus();
}

/**
 * Shell chrome user menu — APG menu-button: Arrow roving, Escape returns focus.
 */
export function UserMenu({ className, userLabel, accountId }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const focusLastOnOpen = useRef(false);
  const menuId = useId();

  function closeMenu(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }

  function focusItem(index: number) {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (items.length === 0) return;
    const next = ((index % items.length) + items.length) % items.length;
    items[next]?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        // Do not steal focus from the outside click target.
        closeMenu(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const items = itemRefs.current.filter(Boolean) as HTMLElement[];
      if (focusLastOnOpen.current) {
        focusItem(items.length - 1);
      } else {
        focusItem(0);
      }
      focusLastOnOpen.current = false;
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  function onBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!rootRef.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusLastOnOpen.current = false;
      setOpen(true);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusLastOnOpen.current = true;
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        return;
      case "ArrowDown":
        event.preventDefault();
        focusItem(currentIndex + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusItem(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        focusItem(0);
        return;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        return;
      case "Tab": {
        event.preventDefault();
        const trigger = triggerRef.current;
        const direction: 1 | -1 = event.shiftKey ? -1 : 1;
        closeMenu(false);
        if (trigger) {
          window.requestAnimationFrame(() => {
            focusAdjacentTabbable(trigger, direction);
          });
        }
        return;
      }
      default:
        return;
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
        id={`${menuId}-trigger`}
        className="inline-flex h-9 items-center rounded-md px-3 text-body-medium text-chrome-foreground hover:bg-sidebar-active-background focus-ring-chrome"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? `${menuId}-menu` : undefined}
        onClick={() => {
          focusLastOnOpen.current = false;
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {userLabel}
      </button>
      {open ? (
        <div
          id={`${menuId}-menu`}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="absolute end-0 top-full z-50 mt-2 min-w-48 rounded-md border border-white/10 bg-chrome p-2 shadow-md"
          onKeyDown={onMenuKeyDown}
        >
          <div role="none" className="px-1 py-1">
            <ThemeToggle
              role="menuitem"
              tabIndex={-1}
              ref={(node) => {
                itemRefs.current[0] = node;
              }}
            />
          </div>
          <div role="none" className="border-t border-white/10 px-1 py-1">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              ref={(node) => {
                itemRefs.current[1] = node;
              }}
              disabled={pending}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-start text-body-medium text-chrome-foreground hover:bg-sidebar-active-background focus-ring-chrome disabled:opacity-50"
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

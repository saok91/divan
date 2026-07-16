"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { SidebarNavItem } from "@/components/app-sidebar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatPersianInteger,
  normalizeDigitsForMatch,
  toPersianDigits,
} from "@/lib/persian-digits";
import { operationalCopy } from "@/lib/operational-copy";
import {
  searchPersonnel,
  type PersonnelSearchHit,
} from "@/lib/personnel-search";
import { cn } from "@/lib/utils";
type CommandPaletteProps = {
  /** Server-resolved, permission-filtered nav (Story 1.5). */
  navItems: readonly SidebarNavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox']",
    )
  ) {
    return true;
  }
  return target.isContentEditable;
}
const ACTIVE_ITEM =
  "data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground";
/**
 * Authenticated-shell command palette: navigation + personnel search stub.
 * Mount once; do not import @divan/identity-access from this client module.
 */
export function CommandPalette({
  navItems,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [personnelHits, setPersonnelHits] = React.useState<
    PersonnelSearchHit[]
  >([]);
  const [searching, setSearching] = React.useState(false);
  const [liveMessage, setLiveMessage] = React.useState("");
  const normalizedQuery = normalizeDigitsForMatch(query);
  const filteredNav = React.useMemo(() => {
    if (!normalizedQuery) return navItems;
    const q = normalizedQuery.toLowerCase();
    return navItems.filter((item) => {
      const labelNorm = normalizeDigitsForMatch(item.label).toLowerCase();
      const hrefNorm = item.href.toLowerCase();
      return labelNorm.includes(q) || hrefNorm.includes(q);
    });
  }, [navItems, normalizedQuery]);
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const hits = await searchPersonnel({
            query,
            normalizedQuery,
          });
          if (cancelled) return;
          setPersonnelHits(hits);
          const total = filteredNav.length + hits.length;
          setLiveMessage(
            total === 0
              ? operationalCopy.emptySearch
              : `${formatPersianInteger(total)} نتیجه`,
          );
        } catch {
          if (cancelled) return;
          setPersonnelHits([]);
          setLiveMessage(operationalCopy.emptySearch);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, normalizedQuery, filteredNav.length]);
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setPersonnelHits([]);
        setSearching(false);
        setLiveMessage("");
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );
  const navigate = React.useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden rounded-lg p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>پالت فرمان</DialogTitle>
          <DialogDescription>جستجوی ناوبری و پرسنل</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="rounded-lg"
          aria-busy={searching || undefined}
        >
          <CommandInput
            placeholder="جستجو…"
            value={query}
            onValueChange={(value) => setQuery(toPersianDigits(value))}
            aria-label="جستجو در پالت فرمان"
          />
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </div>
          <CommandList>
            <CommandEmpty>{operationalCopy.emptySearch}</CommandEmpty>
            {filteredNav.length > 0 ? (
              <CommandGroup heading="ناوبری">
                {filteredNav.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`nav:${item.href}`}
                    className={cn(ACTIVE_ITEM)}
                    onSelect={() => navigate(item.href)}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {personnelHits.length > 0 ? (
              <CommandGroup heading="پرسنل">
                {personnelHits.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={`person:${hit.id}`}
                    className={cn(ACTIVE_ITEM)}
                    onSelect={() => navigate(hit.href)}
                  >
                    {hit.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
type CommandPaletteTriggerProps = {
  navItems: readonly SidebarNavItem[];
};
/**
 * Header trigger + global shortcuts + single palette instance for AppShell.
 */
export function CommandPaletteHost({ navItems }: CommandPaletteTriggerProps) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isTextEntryTarget(event.target)) return;
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <div className="flex w-full max-w-sm flex-1 justify-center">
      <button
        type="button"
        className="inline-flex h-9 w-full items-center rounded-md border border-white/15 bg-sidebar-active-background/40 px-3 text-start text-caption text-chrome-foreground/70 focus-ring-chrome"
        onClick={() => setOpen(true)}
        aria-label="باز کردن پالت فرمان"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <span className="truncate">جستجو…</span>
        <kbd className="ms-auto hidden shrink-0 text-caption text-chrome-foreground/50 sm:inline">
          Ctrl+K
        </kbd>
      </button>
      <CommandPalette
        navItems={navItems}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

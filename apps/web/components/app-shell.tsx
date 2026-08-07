import { AccountThemeSync } from "@/components/account-theme-sync";
import {
  AppSidebar,
  type SidebarNavItem,
} from "@/components/app-sidebar";
import { CommandPaletteHost } from "@/components/command-palette";
import { LeaveGuardProvider } from "@/components/leave-guard";
import { RouteAnnouncer } from "@/components/route-announcer";
import { SkipLink } from "@/components/skip-link";
import { Toaster } from "@/components/ui/toast";
import { UserMenu } from "@/components/user-menu";
import { ViewportGateFocusGuard } from "@/components/viewport-gate-focus-guard";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";

type AppShellProps = {
  children: React.ReactNode;
  /** Signed-in identity label for the user menu. */
  userLabel: string;
  /** Account id for per-account theme storage. */
  accountId: string;
  /** Role-filtered nav items from identity-access (server-resolved). */
  navItems: readonly SidebarNavItem[];
  /** Slot for Story 1.7 banners (stale above break-glass). */
  bannerSlot?: React.ReactNode;
};

/**
 * Fixed navy chrome: skip link → header → banner stack → sidebar + main.
 * Full shell only at ≥1280×720; smaller windows get a Persian gate message.
 * Zoom on a large display does not falsely trigger the gate (JS controller).
 */
export function AppShell({
  children,
  userLabel,
  accountId,
  navItems,
  bannerSlot,
}: AppShellProps) {
  const sizeLabel = `${toPersianDigits("1280")}×${toPersianDigits("720")}`;
  const gateBody = operationalCopy.viewportGateBody.replace("{size}", sizeLabel);

  return (
    <>
      <div
        className="min-viewport-gate min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground"
        role="status"
        tabIndex={-1}
      >
        <p className="text-heading">دیوان</p>
        <p className="mt-3 max-w-md text-body text-muted-foreground">{gateBody}</p>
      </div>

      <ViewportGateFocusGuard />

      <LeaveGuardProvider>
        <div className="app-shell-root">
          <AccountThemeSync accountId={accountId} />
          <SkipLink />
          <RouteAnnouncer />

          <header className="fixed inset-x-0 top-0 z-40 flex h-chrome-height items-center gap-4 bg-chrome px-4 text-chrome-foreground">
            <p className="shrink-0 text-heading-sm">دیوان</p>

            <div className="flex min-w-0 flex-1 justify-center">
              <CommandPaletteHost navItems={navItems} />
            </div>

            <UserMenu
              className="shrink-0"
              userLabel={userLabel}
              accountId={accountId}
            />
          </header>

          <div
            id="banner-stack"
            className="fixed inset-x-0 top-chrome-height z-[35] w-full"
            data-banner-stack
          >
            {bannerSlot}
          </div>

          <AppSidebar accountId={accountId} navItems={navItems} />

          <div
            className="ps-sidebar-current-width motion-safe:transition-[padding-inline-start] motion-safe:duration-[var(--duration-state)] motion-safe:ease-[var(--ease-out)]"
            style={{
              paddingTop:
                "calc(var(--chrome-height) + var(--banner-stack-height, 0px))",
            }}
          >
            <main
              id="main-content"
              tabIndex={-1}
              className="flex min-h-[calc(100vh-var(--chrome-height)-var(--banner-stack-height,0px))] flex-col outline-none"
            >
              {children}
            </main>
          </div>
        </div>
      </LeaveGuardProvider>
      <Toaster />
    </>
  );
}

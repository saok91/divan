import { AccountThemeSync } from "@/components/account-theme-sync";
import {
  AppSidebar,
  type SidebarNavItem,
} from "@/components/app-sidebar";
import { CommandPaletteHost } from "@/components/command-palette";
import { SkipLink } from "@/components/skip-link";
import { UserMenu } from "@/components/user-menu";
import { ViewportGateFocusGuard } from "@/components/viewport-gate-focus-guard";
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
 * Full shell only at ≥1280×720; smaller viewports get a Persian gate message.
 */
export function AppShell({
  children,
  userLabel,
  accountId,
  navItems,
  bannerSlot,
}: AppShellProps) {
  return (
    <>
      <div
        className="min-viewport-gate min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground"
        role="status"
        tabIndex={-1}
      >
        <p className="text-heading">دیوان</p>
        <p className="mt-3 max-w-md text-body text-muted-foreground">
          برای استفاده از دیوان، حداقل وضوح صفحهٔ نمایش{" "}
          <span className="text-tabular text-foreground">
            {toPersianDigits("1280")}×{toPersianDigits("720")}
          </span>{" "}
          لازم است. لطفاً پنجره را بزرگ‌تر کنید یا از نمایشگر دسکتاپ استفاده کنید.
        </p>
      </div>

      <ViewportGateFocusGuard />

      <div className="app-shell-root">
        <AccountThemeSync accountId={accountId} />
        <SkipLink />

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

        <AppSidebar navItems={navItems} />

        <div className="ps-sidebar-width pt-chrome-height">
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-[calc(100vh-var(--chrome-height))] outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

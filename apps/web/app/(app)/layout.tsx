import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getNavItemsForRole,
  getRoleLandingPath,
  getSessionContext,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { BannerStack } from "@/components/banner-stack";
import { PlatformStatusProvider } from "@/components/platform-status-provider";
import { resolveAppPathAccess } from "@/lib/resolve-app-path-access";
import { TRPCReactProvider } from "@/lib/trpc/client";

/**
 * Authenticated desktop shell. Login lives outside this `(app)` group.
 * Server-side session gate + coarse path denial (proxy stays cookie-only).
 * Break-glass banner hydrates from real grants (Story 2.5).
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const headerList = await headers();
  const pathname = headerList.get("x-divan-pathname") ?? "/";
  const { coarseRole, accountId } = session.user;

  if (pathname === "/" || pathname === "") {
    redirect(getRoleLandingPath(coarseRole));
  }

  const access = await resolveAppPathAccess({
    coarseRole,
    accountId,
    pathname,
  });

  const navItems = getNavItemsForRole(coarseRole).map((item) => ({
    href: item.href,
    label: item.label,
  }));

  const fresh = await getSessionContext(accountId);
  const breakGlass = fresh?.breakGlass ?? {
    active: false,
    expiresAt: null,
    incidentId: null,
    grantId: null,
  };

  return (
    <TRPCReactProvider>
      <PlatformStatusProvider
        initial={{
          breakGlass: {
            active: breakGlass.active,
            expiresAt: breakGlass.expiresAt,
            incidentId: breakGlass.incidentId,
            grantId: breakGlass.grantId,
          },
        }}
      >
        <AppShell
          userLabel={session.user.name ?? session.user.username}
          accountId={accountId}
          navItems={navItems}
          bannerSlot={<BannerStack />}
        >
          {access.kind === "allow" ? children : access.ui}
        </AppShell>
      </PlatformStatusProvider>
    </TRPCReactProvider>
  );
}

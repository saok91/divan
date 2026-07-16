import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getNavItemsForRole,
  getRoleLandingPath,
  getSessionContext,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AuthzChangedModal } from "@/components/authz-changed-modal";
import { BannerStack } from "@/components/banner-stack";
import { PlatformStatusProvider } from "@/components/platform-status-provider";
import { resolveAppPathAccess } from "@/lib/resolve-app-path-access";
import { TRPCReactProvider } from "@/lib/trpc/client";

/**
 * Authenticated desktop shell. Login lives outside this `(app)` group.
 * Server-side session gate + coarse path denial (proxy stays cookie-only).
 * Break-glass banner hydrates from real grants (Story 2.5).
 * Mid-session authz modal is separate from stale-banner (Story 2.6).
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

  const priorFp = session.user.authzBindingFingerprint?.trim() || "";
  // Real mid-session change only when a prior snapshot exists and differs.
  // Empty prior is hydrated on JWT refresh (auth.ts) — not a perpetual modal.
  const authzChanged =
    Boolean(priorFp) &&
    Boolean(fresh?.authzBindingFingerprint) &&
    priorFp !== fresh!.authzBindingFingerprint;

  const landingPath = getRoleLandingPath(coarseRole);

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
          authzChanged,
          // Demo draft stand-in open when authz just changed (Epic 4 seam).
          demoDraftOpen: authzChanged,
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
        <AuthzChangedModal landingPath={landingPath} />
      </PlatformStatusProvider>
    </TRPCReactProvider>
  );
}

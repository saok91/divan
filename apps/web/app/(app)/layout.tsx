import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getNavItemsForRole,
  getRoleLandingPath,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { resolveAppPathAccess } from "@/lib/resolve-app-path-access";

/**
 * Authenticated desktop shell. Login lives outside this `(app)` group.
 * Server-side session gate + coarse path denial (proxy stays cookie-only).
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

  return (
    <AppShell
      userLabel={session.user.name ?? session.user.username}
      accountId={accountId}
      navItems={navItems}
    >
      {access.kind === "allow" ? children : access.ui}
    </AppShell>
  );
}

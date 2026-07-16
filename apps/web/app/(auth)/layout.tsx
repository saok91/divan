import { redirect } from "next/navigation";

import { getRoleLandingPath } from "@divan/identity-access";

import { auth } from "@/auth";

/**
 * Auth route group — no AppShell chrome (Story 1.4).
 * Server-side: authenticated users leave /login for their role landing.
 */
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (session?.user?.accountId && session.user.coarseRole) {
    redirect(getRoleLandingPath(session.user.coarseRole));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      {children}
    </div>
  );
}

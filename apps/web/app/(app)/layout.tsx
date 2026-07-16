import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

/**
 * Authenticated desktop shell. Login lives outside this `(app)` group.
 * Server-side session gate complements optimistic proxy cookie check.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.accountId) {
    redirect("/login");
  }

  return (
    <AppShell
      userLabel={session.user.name ?? session.user.username}
      accountId={session.user.accountId}
    >
      {children}
    </AppShell>
  );
}

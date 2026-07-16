import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Auth route group — no AppShell chrome (Story 1.4).
 * Server-side: authenticated users leave /login for the app (avoids proxy cookie loop).
 */
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (session?.user?.accountId) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      {children}
    </div>
  );
}

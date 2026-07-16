import { AppShell } from "@/components/app-shell";

/**
 * Authenticated desktop shell. Future login/auth routes should live outside
 * this `(app)` group so they are not wrapped in chrome (Story 1.4).
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}

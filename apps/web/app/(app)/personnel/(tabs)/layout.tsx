import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/personnel")!;

/**
 * Personnel section tabs — dictionary tab Admin-only (Story 4b.7).
 */
export default async function PersonnelTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const isAdmin = session.user.coarseRole === "hr_admin";
  const tabs = isAdmin
    ? SURFACE.tabs
    : SURFACE.tabs.filter((t) => t.id !== "dictionary");

  return (
    <SurfaceSectionTabsLayout
      surface={SURFACE}
      tabs={tabs}
      purpose="جستجو و مدیریت هویت افراد برای اپراتورهای منابع انسانی در محدودهٔ دسترسی."
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

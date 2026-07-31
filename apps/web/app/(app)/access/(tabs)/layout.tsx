import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/access")!;

export default function AccessTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SurfaceSectionTabsLayout
      surface={SURFACE}
      purpose="مدیریت اعطای نقش، محدودهٔ سازمانی و دسترسی اضطراری برای ادمین دسترسی."
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

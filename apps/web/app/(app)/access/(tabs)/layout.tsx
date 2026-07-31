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
      purpose="اعطای دسترسی، نقش‌ها، محدوده‌ها و دسترسی اضطراری."
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

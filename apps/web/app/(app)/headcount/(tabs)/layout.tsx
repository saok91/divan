import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/headcount")!;

export default function HeadcountTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SurfaceSectionTabsLayout
      surface={SURFACE}
      purpose="مدیریت ظرفیت، رزرو و درخواست هدکانت برای برنامه‌ریزان نیروی کار."
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

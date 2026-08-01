import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/reports")!;

export default function ReportsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SurfaceSectionTabsLayout
      surface={SURFACE}
      purpose="کاتالوگ گزارش‌های تأییدشدهٔ راه‌اندازی — انتخاب بر اساس موضوع، سپس پارامتر و اجرا."
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

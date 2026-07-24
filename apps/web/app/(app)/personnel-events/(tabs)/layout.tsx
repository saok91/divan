import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find(
  (s) => s.root === "/personnel-events",
)!;

export default function PersonnelEventsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SurfaceSectionTabsLayout surface={SURFACE}>
      {children}
    </SurfaceSectionTabsLayout>
  );
}

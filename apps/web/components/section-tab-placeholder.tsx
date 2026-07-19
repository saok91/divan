import { SECTION_TAB_PLACEHOLDER } from "@/lib/section-tab-surfaces";

/** Placeholder body for section tabs until later Epic 4b stories fill content. */
export function SectionTabPlaceholder() {
  return (
    <div className="p-6">
      <p className="text-body text-muted-foreground">{SECTION_TAB_PLACEHOLDER}</p>
    </div>
  );
}

"use client";

import { SharedBulkEntryFlow } from "@/components/import/shared-bulk-entry-flow";

/** Client host for shared five-step day-to-day bulk entry (Story 9.2). */
export function BulkImportCatalogueHost({
  section,
}: {
  section?: "personnel" | "personnel-events" | "headcount";
}) {
  return <SharedBulkEntryFlow section={section} />;
}

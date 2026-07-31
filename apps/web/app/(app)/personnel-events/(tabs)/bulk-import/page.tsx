import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SectionTabPlaceholder } from "@/components/section-tab-placeholder";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * ورود گروهی (رویدادها) — thin placeholder; Epic 6 / day-to-day bulk later.
 */
export default async function PersonnelEventsBulkImportPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <div className="space-y-2">
      <SectionTabPlaceholder />
      <p className="text-caption text-text-secondary px-content-padding-inline">
        ورود گروهی روزمرهٔ رویدادها بعداً تکمیل می‌شود. ویزارد پیشرفته در «ورود
        داده» باقی می‌ماند.
      </p>
    </div>
  );
}

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SectionTabPlaceholder } from "@/components/section-tab-placeholder";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * ورود گروهی (پرسنل) — thin placeholder; Epic 6 / day-to-day bulk later.
 */
export default async function PersonnelBulkImportPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel");

  return (
    <div className="space-y-2">
      <SectionTabPlaceholder />
      <p className="text-caption text-text-secondary px-content-padding-inline">
        ورود گروهی روزمرهٔ پرسنل بعداً تکمیل می‌شود. ویزارد پیشرفته در «ورود داده»
        باقی می‌ماند.
      </p>
    </div>
  );
}

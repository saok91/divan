import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import/import-wizard";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Controlled import wizard (Story 6.1) — advanced/migration path.
 * Day-to-day section «ورود گروهی» stays on section tabs (unchanged).
 * Layout≠RSC: assert before any future data load.
 */
export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/import");

  return (
    <div className="mx-auto max-w-[90rem] space-y-4 bg-background p-6 text-foreground">
      <div className="space-y-1">
        <h1 className="text-heading">ورود داده</h1>
        <p className="text-body text-muted-foreground">
          ویزارد کنترل‌شدهٔ واردسازی: شناسایی → اعتبارسنجی → پیش‌نمایش → تأیید
          پیش‌نویس. اجرای قطعی تولید در داستان ۶٫۲ است.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}

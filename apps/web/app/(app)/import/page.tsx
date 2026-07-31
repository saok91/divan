import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/page-header";
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
    <div className="mx-auto max-w-[90rem] space-y-4 bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            ورود داده
          </span>
        }
        title="ورود داده"
        purpose="ویزارد کنترل‌شدهٔ واردسازی: شناسایی → اعتبارسنجی → پیش‌نمایش → تأیید پیش‌نویس."
      />
      <div className="px-content-padding-inline pb-6">
        <ImportWizard />
      </div>
    </div>
  );
}

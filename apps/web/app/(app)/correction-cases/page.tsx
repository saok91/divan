import { Suspense } from "react";
import { redirect } from "next/navigation";

import { CorrectionCasesPanel } from "@/components/correction-cases/correction-cases-panel";
import { PageHeader } from "@/components/page-header";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * External data-subject correction cases (Story 7.5 / FR-53; Story 9.7 URL prefill).
 * Suspense: useSearchParams for ?person=&open=1 from profile CTA.
 */
export default async function CorrectionCasesPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/correction-cases");

  return (
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        id="correction-cases-heading"
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پرونده‌های اصلاح
          </span>
        }
        title="پرونده‌های اصلاح"
        purpose="پیگیری درخواست‌های شفافیت و اصلاح دادهٔ موضوع خارجی برای تیم حاکمیت داده."
      />
      <div className="px-content-padding-inline pb-6">
        <Suspense
          fallback={
            <FeedbackMessage kind="loading">
              در حال بارگذاری پرونده‌های اصلاح…
            </FeedbackMessage>
          }
        >
          <CorrectionCasesPanel />
        </Suspense>
      </div>
    </div>
  );
}

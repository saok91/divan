import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FullBleedTableHost } from "@/components/layout/panel-section";
import { PersonnelEventsListPanel } from "@/components/personnel/personnel-events-list-panel";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * رویدادها tab — real catalogue (Story 9.6 / 9.7 URL hydrate).
 * Suspense: useSearchParams for reconcile filter presets.
 */
export default async function PersonnelEventsEventsPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <FullBleedTableHost className="py-4">
      <Suspense
        fallback={
          <FeedbackMessage kind="loading">
            در حال بارگذاری فهرست رویدادها…
          </FeedbackMessage>
        }
      >
        <PersonnelEventsListPanel />
      </Suspense>
    </FullBleedTableHost>
  );
}

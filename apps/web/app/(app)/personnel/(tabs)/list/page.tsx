import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FullBleedTableHost } from "@/components/layout/panel-section";
import { PersonnelListPanel } from "@/components/personnel/personnel-list-panel";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default personnel tab — governed list (Story 4b.7 / 9.7 URL hydrate).
 * Suspense: useSearchParams for ?teamId= reconcile presets.
 */
export default async function PersonnelListPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  return (
    <FullBleedTableHost className="py-4">
      <Suspense
        fallback={
          <FeedbackMessage kind="loading">
            در حال بارگذاری فهرست پرسنل…
          </FeedbackMessage>
        }
      >
        <PersonnelListPanel />
      </Suspense>
    </FullBleedTableHost>
  );
}

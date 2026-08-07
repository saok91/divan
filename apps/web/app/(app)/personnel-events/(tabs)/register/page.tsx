import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FormSurfaceHost } from "@/components/layout/panel-section";
import { PersonnelEventFormHost } from "@/components/personnel/personnel-event-form-host";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * ثبت رویداد — hosts Epic 4 PersonnelEventForm (Story 4b.7 / UX-DR11).
 * FormSurfaceHost: content `surface` plane on page shell (Story 11.5).
 * Suspense: useSearchParams for ?person= prefill.
 */
export default async function PersonnelEventsRegisterPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <FormSurfaceHost>
      <Suspense
        fallback={
          <p
            className="text-body text-text-secondary px-content-padding-inline py-4"
            role="status"
          >
            در حال بارگذاری فرم رویداد…
          </p>
        }
      >
        <PersonnelEventFormHost />
      </Suspense>
    </FormSurfaceHost>
  );
}

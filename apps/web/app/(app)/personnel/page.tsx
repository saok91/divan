import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CurrentPersonStateForeshadow } from "@/components/personnel/current-person-state-foreshadow";
import { PersonnelDemoSection } from "@/components/personnel/personnel-demo-section";
import { PersonnelEventForm } from "@/components/personnel/personnel-event-form";
import { PersonnelPanel } from "@/components/personnel/personnel-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Personnel surface (Story 3.1 / FR-5 + Story 4.2 فرم رویداد + Story 4.9 foreshadow).
 * Layout path-gate is not enough — assert before any client data load (Layout ≠ RSC).
 */
export default async function PersonnelPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  return (
    <div className="space-y-10 p-6">
      <PersonnelPanel />
      <CurrentPersonStateForeshadow />
      <PersonnelEventForm />
      <PersonnelDemoSection />
    </div>
  );
}

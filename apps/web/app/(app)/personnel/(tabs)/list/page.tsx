import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GovernedDataTableFixtureDemo } from "@/components/governed-data-table";
import { CurrentPersonStateForeshadow } from "@/components/personnel/current-person-state-foreshadow";
import { PersonnelDemoSection } from "@/components/personnel/personnel-demo-section";
import { PersonnelEventForm } from "@/components/personnel/personnel-event-form";
import { PersonnelPanel } from "@/components/personnel/personnel-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default personnel tab — existing Epic 3/4 content (Story 4b.2).
 * Layout ≠ RSC: assert before any client data load.
 * Story 4b.4: fixture governed-data-table demo (not FR33 wiring).
 */
export default async function PersonnelListPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  return (
    <div className="space-y-10 p-6">
      <GovernedDataTableFixtureDemo />
      <PersonnelPanel />
      <CurrentPersonStateForeshadow />
      <PersonnelEventForm />
      <PersonnelDemoSection />
    </div>
  );
}

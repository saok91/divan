import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { defaultTabHref, SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/personnel-events");

/**
 * Personnel-events root → default section tab (Story 4b.7).
 */
export default async function PersonnelEventsIndexPage() {
  if (!SURFACE) {
    redirect("/dashboard");
  }
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");
  redirect(defaultTabHref(SURFACE));
}

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { defaultTabHref, SECTION_TAB_SURFACES } from "@/lib/section-tab-surfaces";

const SURFACE = SECTION_TAB_SURFACES.find((s) => s.root === "/headcount");

export default async function HeadcountIndexPage() {
  if (!SURFACE) {
    redirect("/dashboard");
  }
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/headcount");
  redirect(defaultTabHref(SURFACE));
}

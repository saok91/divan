import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalCreateForm } from "@/components/headcount/headcount-approval-create-form";
import { FormSurfaceHost } from "@/components/layout/panel-section";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Headcount create tab — full approval FormLayout form (Story 9.4).
 * FormSurfaceHost: content `surface` plane on page shell (Story 11.5).
 */
export default async function HeadcountCreatePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/headcount");
  return (
    <FormSurfaceHost>
      <HeadcountApprovalCreateForm />
    </FormSurfaceHost>
  );
}

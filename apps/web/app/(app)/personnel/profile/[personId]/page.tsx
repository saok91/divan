import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { PersonProfileView } from "@/components/personnel/person-profile-view";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { getSessionContext } from "@divan/identity-access";
import { isPersonUuid, PersonIdentityError } from "@divan/person-employment";

import { assertPersonInScopedPopulation } from "~/server/personnel-scoped-search";

type PersonnelProfilePageProps = {
  params: Promise<{ personId: string }>;
};

/**
 * Permission-filtered Person profile (Story 5.2 / FR-34).
 * Server gate mirrors getById IDOR; facts via getCurrentPersonState.
 */
export default async function PersonnelProfilePage({
  params,
}: PersonnelProfilePageProps) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  const { personId } = await params;
  if (!isPersonUuid(personId)) {
    redirect("/personnel/list");
  }

  const fresh = await getSessionContext(session.user.accountId);
  if (!fresh) {
    redirect("/login");
  }

  try {
    await assertPersonInScopedPopulation({
      personId,
      actorAccountId: fresh.accountId,
      actorScopeCodes: fresh.organizationalScopeCodes,
      correlationId: randomUUID(),
    });
  } catch (err) {
    if (
      err instanceof PersonIdentityError &&
      err.code === "PERSON_NOT_FOUND"
    ) {
      redirect("/personnel/list");
    }
    throw err;
  }

  return (
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پرسنل
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پروفایل
          </span>
        }
        title="پروفایل فرد"
        purpose="وضعیت جاری فرد در محدودهٔ دسترسی شما."
      />
      <div className="px-content-padding-inline py-4">
        <PersonProfileView personId={personId} />
      </div>
    </div>
  );
}

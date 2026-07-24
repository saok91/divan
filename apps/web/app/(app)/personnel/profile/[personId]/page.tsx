import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { PersonProfileView } from "@/components/personnel/person-profile-view";
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
    <div className="p-6">
      <PersonProfileView personId={personId} />
    </div>
  );
}

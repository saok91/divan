import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalsTable } from "@/components/headcount/headcount-approvals-table";
import { assertPageAccess } from "@/lib/assert-page-access";
import { isPersonUuid } from "@divan/person-employment";

type HeadcountCapacityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * Default headcount tab — one approvals GovernedDataTable (Story 9.4 / UX-DR34).
 * Story 9.7 — hydrate optional `?teamId=` from reconcile deep-links.
 */
export default async function HeadcountCapacityPage({
  searchParams,
}: HeadcountCapacityPageProps) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/headcount");

  const query = await searchParams;
  const rawTeamId = firstQueryValue(query.teamId)?.trim();
  const teamIdMalformed = Boolean(rawTeamId && !isPersonUuid(rawTeamId));
  const teamId =
    rawTeamId && isPersonUuid(rawTeamId) ? rawTeamId : undefined;

  return (
    <HeadcountApprovalsTable
      initialTeamId={teamId}
      teamIdMalformed={teamIdMalformed}
    />
  );
}

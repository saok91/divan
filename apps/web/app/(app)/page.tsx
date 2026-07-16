import { redirect } from "next/navigation";

import { getRoleLandingPath } from "@divan/identity-access";

import { auth } from "@/auth";

/** Authenticated `/` always lands on the caller's role first surface. */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.coarseRole) {
    redirect("/login");
  }
  redirect(getRoleLandingPath(session.user.coarseRole));
}

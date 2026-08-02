import { redirect } from "next/navigation";

import type { CoarseRole } from "@divan/identity-access";

import { auth } from "@/auth";
import { SurfaceSectionTabsLayout } from "@/components/surface-section-tabs-layout";
import { operationalCopy } from "@/lib/operational-copy";
import {
  settingsSurfaceFromTabs,
  visibleSettingsTabsForRole,
} from "@/lib/settings-domain-map";

/**
 * Settings section tabs — role-split + empty-domain omit (Story 10.2 / UX-DR36).
 * Nested path segments only (no `?tab=`); one-shot URL identity via Link tablist.
 * Surface.tabs always mirrors the filtered tablist (no full-catalog fallback).
 */
export default async function SettingsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const coarseRole = session.user.coarseRole as CoarseRole;
  const tabs = visibleSettingsTabsForRole(coarseRole);
  const surface = settingsSurfaceFromTabs(tabs);

  return (
    <SurfaceSectionTabsLayout
      surface={surface}
      tabs={tabs}
      purpose={operationalCopy.settingsSurfacePurpose}
    >
      {children}
    </SurfaceSectionTabsLayout>
  );
}

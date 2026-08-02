/**
 * Settings domain panel — registry-driven list via tRPC (Story 10.2).
 * FeedbackMessage for loading / empty / error / store-unavailable.
 * No mutation controls.
 */

"use client";

import type { SettingsOwningDomain } from "@divan/app-settings";

import { SettingsParameterRow } from "@/components/settings/settings-parameter-row";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

type SettingsDomainPanelProps = {
  domain: SettingsOwningDomain;
};

export function SettingsDomainPanel({ domain }: SettingsDomainPanelProps) {
  const query = api.settings.listByDomain.useQuery(
    { domain },
    { refetchOnWindowFocus: false },
  );

  if (query.isLoading || (query.isFetching && !query.data)) {
    return (
      <FeedbackMessage kind="loading">{operationalCopy.settingsLoading}</FeedbackMessage>
    );
  }

  if (query.isError) {
    return (
      <FeedbackMessage kind="error">
        {query.error.message || operationalCopy.settingsLoadError}
      </FeedbackMessage>
    );
  }

  const rows = query.data?.rows ?? [];
  const storeUnavailable = query.data?.storeUnavailable === true;
  const storeDetail =
    query.data?.detailFa?.trim() ||
    operationalCopy.settingsStoreUnavailable;

  if (rows.length === 0) {
    return (
      <FeedbackMessage kind="empty">{operationalCopy.settingsEmpty}</FeedbackMessage>
    );
  }

  return (
    <div className="space-y-4">
      {storeUnavailable ? (
        <FeedbackMessage kind="info">{storeDetail}</FeedbackMessage>
      ) : null}
      <div className="divide-y-0" role="list" aria-label="پارامترهای تنظیمات">
        {rows.map((row) => (
          <div key={row.key} role="listitem">
            <SettingsParameterRow row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}

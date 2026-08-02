/**
 * Settings domain panel — registry-driven list via tRPC (Story 10.2–10.3).
 * FeedbackMessage for loading / empty / error / store-unavailable / mutation result.
 */

"use client";

import { useEffect, useState } from "react";
import type { SettingsOwningDomain } from "@divan/app-settings";

import type { SettingsMutationFeedback } from "@/components/settings/settings-parameter-editor";
import { SettingsParameterRow } from "@/components/settings/settings-parameter-row";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { operationalCopy } from "@/lib/operational-copy";
import type { SettingsParameterRowDto } from "@/lib/settings-types";
import { api } from "@/lib/trpc/client";

type SettingsDomainPanelProps = {
  domain: SettingsOwningDomain;
};

export function SettingsDomainPanel({ domain }: SettingsDomainPanelProps) {
  const query = api.settings.listByDomain.useQuery(
    { domain },
    { refetchOnWindowFocus: false },
  );
  /** Optimistic patches until query refetch lands — never start as [] while data exists. */
  const [rowPatches, setRowPatches] = useState<
    Record<string, SettingsParameterRowDto>
  >({});
  const [feedback, setFeedback] = useState<SettingsMutationFeedback | null>(
    null,
  );

  useEffect(() => {
    setRowPatches({});
  }, [domain, query.dataUpdatedAt]);

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

  const queryRows = query.data?.rows ?? [];
  const rows = queryRows.map((r) => rowPatches[r.key] ?? r);
  const storeUnavailable = query.data?.storeUnavailable === true;
  const storeDetail =
    query.data?.detailFa?.trim() || operationalCopy.settingsStoreUnavailable;

  if (rows.length === 0) {
    return (
      <FeedbackMessage kind="empty">{operationalCopy.settingsEmpty}</FeedbackMessage>
    );
  }

  function handleRowUpdated(updated: SettingsParameterRowDto) {
    setRowPatches((prev) => ({ ...prev, [updated.key]: updated }));
  }

  return (
    <div className="space-y-4">
      {storeUnavailable ? (
        <FeedbackMessage kind="info">{storeDetail}</FeedbackMessage>
      ) : null}
      {feedback ? (
        <FeedbackMessage kind={feedback.kind}>{feedback.message}</FeedbackMessage>
      ) : null}
      <div className="divide-y-0" role="list" aria-label="پارامترهای تنظیمات">
        {rows.map((row) => (
          <div key={row.key} role="listitem">
            <SettingsParameterRow
              row={row}
              storeUnavailable={storeUnavailable}
              onRowUpdated={handleRowUpdated}
              onFeedback={setFeedback}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

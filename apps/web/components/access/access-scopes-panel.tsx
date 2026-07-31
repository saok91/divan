"use client";

import { operationalCopy } from "@/lib/operational-copy";

import { useId, useState } from "react";

import { AccessSection } from "@/components/access/access-section";
import { AccessStatusMessage } from "@/components/access/access-status-message";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/trpc/client";

export function AccessScopesPanel() {
  const scopesQuery = api.accessAdmin.listScopes.useQuery();
  const utils = api.useUtils();

  const createScope = api.accessAdmin.createScope.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listScopes.invalidate();
      await utils.accessAdmin.listGrants.invalidate();
    },
  });
  const updateScope = api.accessAdmin.updateScope.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listScopes.invalidate();
      await utils.accessAdmin.listGrants.invalidate();
    },
  });

  const [scopeLabel, setScopeLabel] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const scopeLabelId = useId();

  useLeaveGuardRegistration({
    id: "access-scopes-create",
    isDirty: scopeLabel.trim().length > 0,
    onDiscard: () => setScopeLabel(""),
  });

  function captureError(err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "عملیات انجام نشد.";
    setActionError(message);
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-small text-foreground">محدوده‌ها</h1>
        <p className="text-body-large text-muted-foreground">
          محدوده‌های سازمانی فقط با برچسب و وضعیت فعال/غیرفعال — نه درخت واحد
          سازمانی.
        </p>
      </header>

      {actionError ? (
        <AccessStatusMessage kind="error">{actionError}</AccessStatusMessage>
      ) : null}

      <AccessSection
        title="محدوده‌های سازمانی"
        description="ایجاد محدوده به‌صورت درخواست entitlement ثبت می‌شود و پس از تأیید مستقل فعال می‌گردد."
      >
        {scopesQuery.isLoading ? (
          <AccessStatusMessage kind="loading">
            در حال بارگذاری…
          </AccessStatusMessage>
        ) : scopesQuery.isError ? (
          <AccessStatusMessage kind="error">
            {scopesQuery.error.message}
          </AccessStatusMessage>
        ) : (
          <ul className="flex flex-col gap-2 text-body-medium">
            {(scopesQuery.data ?? []).map((scope) => (
              <li
                key={scope.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2"
              >
                <span>
                  {scope.labelFa}
                  <span className="ms-2 text-muted-foreground">
                    {scope.active ? "فعال" : "غیرفعال"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  disabled={updateScope.isPending}
                  onClick={() => {
                    setActionError(null);
                    updateScope.mutate(
                      { id: scope.id, active: !scope.active },
                      { onError: captureError },
                    );
                  }}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {scope.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            createScope.mutate(
              { labelFa: scopeLabel },
              {
                onError: captureError,
                onSuccess: () => setScopeLabel(""),
              },
            );
          }}
        >
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label htmlFor={scopeLabelId} className="text-label-medium">
              برچسب محدوده
            </label>
            <Input
              id={scopeLabelId}
              value={scopeLabel}
              onChange={(e) => setScopeLabel(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={createScope.isPending}
          
            disabledReason={operationalCopy.actionPending}
          >
            درخواست ایجاد محدوده
          </Button>
        </form>
      </AccessSection>
    </div>
  );
}

"use client";

import { operationalCopy } from "@/lib/operational-copy";

import { useId, useState } from "react";

import { AccessSection } from "@/components/access/access-section";
import { AccessStatusMessage } from "@/components/access/access-status-message";
import { EntitlementGrantsPanel } from "@/components/access/entitlement-grants-panel";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/trpc/client";

export function AccessRolesPanel({
  currentAccountId,
}: {
  currentAccountId?: string;
}) {
  const permissionSetsQuery = api.accessAdmin.listPermissionSets.useQuery();
  const rolesQuery = api.accessAdmin.listRoles.useQuery();

  const utils = api.useUtils();

  const createPermissionSet = api.accessAdmin.createPermissionSet.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listPermissionSets.invalidate();
    },
  });
  const createRole = api.accessAdmin.createRole.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listRoles.invalidate();
      await utils.accessAdmin.listGrants.invalidate();
    },
  });

  const [setName, setSetName] = useState("");
  const [setPermissions, setSetPermissions] = useState("access.administration");
  const [roleCode, setRoleCode] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [roleSetId, setRoleSetId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const setNameId = useId();
  const setPermId = useId();
  const roleCodeId = useId();
  const roleLabelId = useId();
  const roleSetIdField = useId();

  const createFormsDirty =
    setName.trim().length > 0 ||
    setPermissions.trim() !== "access.administration" ||
    roleCode.trim().length > 0 ||
    roleLabel.trim().length > 0 ||
    roleSetId.length > 0;

  useLeaveGuardRegistration({
    id: "access-roles-create",
    isDirty: createFormsDirty,
    onDiscard: () => {
      setSetName("");
      setSetPermissions("access.administration");
      setRoleCode("");
      setRoleLabel("");
      setRoleSetId("");
    },
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
        <h1 className="text-headline-small text-foreground">نقش‌ها</h1>
        <p className="text-body-large text-muted-foreground">
          مجموعه‌های مجوز و نقش‌های دسترسی — ایجاد با ثبت قابل انتساب؛ قوانین
          toxic همچنان fail-closed.
        </p>
      </header>

      {actionError ? (
        <AccessStatusMessage kind="error">{actionError}</AccessStatusMessage>
      ) : null}

      <AccessSection
        title="مجموعه‌های مجوز"
        description="کدهای مجوز envelope به‌صورت صریح؛ برچسب نقش درشت اجازهٔ ضمنی نمی‌دهد."
      >
        {permissionSetsQuery.isLoading ? (
          <AccessStatusMessage kind="loading">
            در حال بارگذاری…
          </AccessStatusMessage>
        ) : permissionSetsQuery.isError ? (
          <AccessStatusMessage kind="error">
            {permissionSetsQuery.error.message}
          </AccessStatusMessage>
        ) : (
          <ul className="flex flex-col gap-2 text-body-medium">
            {(permissionSetsQuery.data ?? []).map((set) => (
              <li key={set.id} className="border-b border-border/50 py-2">
                <span className="font-medium">{set.name}</span>
                <span className="ms-2 text-muted-foreground">
                  {set.permissions.join("، ") || "(خالی)"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            createPermissionSet.mutate(
              {
                name: setName,
                permissions: setPermissions
                  .split(/[,\s]+/)
                  .map((p) => p.trim())
                  .filter(Boolean),
              },
              {
                onError: captureError,
                onSuccess: () => {
                  setSetName("");
                  setSetPermissions("access.administration");
                },
              },
            );
          }}
        >
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label htmlFor={setNameId} className="text-label-medium">
              نام مجموعه
            </label>
            <Input
              id={setNameId}
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              required
            />
          </div>
          <div className="flex min-w-[14rem] flex-[2] flex-col gap-1">
            <label htmlFor={setPermId} className="text-label-medium">
              مجوزها (با فاصله یا ویرگول)
            </label>
            <Input
              id={setPermId}
              value={setPermissions}
              onChange={(e) => setSetPermissions(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={createPermissionSet.isPending}
          
            disabledReason={operationalCopy.actionPending}
          >
            افزودن مجموعه
          </Button>
        </form>
      </AccessSection>

      <AccessSection
        title="نقش‌های دسترسی"
        description="ایجاد نقش به‌صورت درخواست entitlement ثبت می‌شود؛ هر نقش باید به یک مجموعه مجوز متصل باشد."
      >
        {rolesQuery.isLoading ? (
          <AccessStatusMessage kind="loading">
            در حال بارگذاری…
          </AccessStatusMessage>
        ) : rolesQuery.isError ? (
          <AccessStatusMessage kind="error">
            {rolesQuery.error.message}
          </AccessStatusMessage>
        ) : (
          <ul className="flex flex-col gap-2 text-body-medium">
            {(rolesQuery.data ?? []).map((role) => (
              <li key={role.id} className="border-b border-border/50 py-2">
                <span className="font-medium">{role.labelFa}</span>
                <span className="ms-2 text-muted-foreground">
                  {role.code} → {role.permissionSet.name}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            createRole.mutate(
              {
                code: roleCode,
                labelFa: roleLabel,
                permissionSetId: roleSetId,
              },
              {
                onError: captureError,
                onSuccess: () => {
                  setRoleCode("");
                  setRoleLabel("");
                  setRoleSetId("");
                },
              },
            );
          }}
        >
          <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <label htmlFor={roleCodeId} className="text-label-medium">
              کد نقش
            </label>
            <Input
              id={roleCodeId}
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              required
            />
          </div>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <label htmlFor={roleLabelId} className="text-label-medium">
              برچسب
            </label>
            <Input
              id={roleLabelId}
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex min-w-[12rem] flex-[2] flex-col gap-1">
            <label htmlFor={roleSetIdField} className="text-label-medium">
              مجموعه مجوز
            </label>
            <select
              id={roleSetIdField}
              className="h-9 rounded-sm border border-input bg-transparent px-3 text-body-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={roleSetId}
              onChange={(e) => setRoleSetId(e.target.value)}
              required
            >
              <option value="">انتخاب کنید</option>
              {(permissionSetsQuery.data ?? []).map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={createRole.isPending}
          
            disabledReason={operationalCopy.actionPending}
          >
            درخواست ایجاد نقش
          </Button>
        </form>
      </AccessSection>

      <EntitlementGrantsPanel currentAccountId={currentAccountId} />
    </div>
  );
}

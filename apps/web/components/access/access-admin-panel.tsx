"use client";

import { useId, useState } from "react";

import { EntitlementGrantsPanel } from "@/components/access/entitlement-grants-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <header className="flex flex-col gap-1">
        <h2 className="text-title-medium text-foreground">{title}</h2>
        <p className="text-body-medium text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function StatusMessage({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "text-body-medium",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

export function AccessAdminPanel({
  currentAccountId,
}: {
  currentAccountId?: string;
}) {
  const entitlementsQuery = api.accessAdmin.listEntitlements.useQuery();
  const scopesQuery = api.accessAdmin.listScopes.useQuery();
  const permissionSetsQuery = api.accessAdmin.listPermissionSets.useQuery();
  const rolesQuery = api.accessAdmin.listRoles.useQuery();

  const utils = api.useUtils();

  const createScope = api.accessAdmin.createScope.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listScopes.invalidate();
      await utils.accessAdmin.listGrants.invalidate();
    },
  });
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
  const assignRoles = api.accessAdmin.assignAccountRoles.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listEntitlements.invalidate();
    },
  });
  const assignScopes = api.accessAdmin.assignAccountScopes.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listEntitlements.invalidate();
    },
  });
  const updateLink = api.accessAdmin.updateAccountLink.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listEntitlements.invalidate();
    },
  });
  const setStatus = api.accessAdmin.setAccountStatus.useMutation({
    onSuccess: async () => {
      await utils.accessAdmin.listEntitlements.invalidate();
    },
  });

  const [scopeLabel, setScopeLabel] = useState("");
  const [setName, setSetName] = useState("");
  const [setPermissions, setSetPermissions] = useState("access.administration");
  const [roleCode, setRoleCode] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [roleSetId, setRoleSetId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [linkValue, setLinkValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const scopeLabelId = useId();
  const setNameId = useId();
  const setPermId = useId();
  const roleCodeId = useId();
  const roleLabelId = useId();
  const roleSetIdField = useId();
  const accountSelectId = useId();
  const linkId = useId();

  const selected = entitlementsQuery.data?.find(
    (row) => row.accountId === selectedAccountId,
  );

  function captureError(err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "عملیات انجام نشد.";
    setActionError(message);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-small text-foreground">دسترسی‌ها</h1>
        <p className="text-body-large text-muted-foreground">
          مدیریت نقش‌ها، مجموعه‌های مجوز، محدوده‌های سازمانی، چرخهٔ entitlement،
          پیوند حساب و وضعیت فعال — با ثبت قابل انتساب در شواهد دسترسی.
        </p>
      </header>

      {actionError ? (
        <StatusMessage kind="error">{actionError}</StatusMessage>
      ) : null}

      <EntitlementGrantsPanel currentAccountId={currentAccountId} />

      <Section
        title="تخصیص نقش و محدوده"
        description="فهرست تخصیص‌های فعلی حساب‌ها. تخصیص انبوه یا ایجاد نقش/محدوده از مسیر تأیید مستقل است."
      >
        {entitlementsQuery.isLoading ? (
          <StatusMessage kind="loading">در حال بارگذاری تخصیص‌ها…</StatusMessage>
        ) : entitlementsQuery.isError ? (
          <StatusMessage kind="error">
            {entitlementsQuery.error.message || "بارگذاری تخصیص‌ها ممکن نشد."}
          </StatusMessage>
        ) : !entitlementsQuery.data?.some(
            (row) =>
              row.accessRoleIds.length > 0 ||
              row.organizationalScopeIds.length > 0,
          ) ? (
          <StatusMessage kind="empty">{operationalCopy.emptyEntitlements}</StatusMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-body-medium">
              <thead>
                <tr className="border-b border-border text-start">
                  <th className="sticky start-0 bg-background px-2 py-2 font-medium">
                    حساب
                  </th>
                  <th className="px-2 py-2 font-medium">نقش‌های دسترسی</th>
                  <th className="px-2 py-2 font-medium">محدوده‌ها</th>
                  <th className="px-2 py-2 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {entitlementsQuery.data.map((row) => (
                  <tr
                    key={row.accountId}
                    className="border-b border-border/60"
                  >
                    <td className="sticky start-0 bg-background px-2 py-2">
                      <button
                        type="button"
                        className="rounded-sm text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => {
                          setSelectedAccountId(row.accountId);
                          setLinkValue(row.externalDirectoryId ?? "");
                          setActionError(null);
                        }}
                      >
                        {row.displayName}
                        <span className="mt-0.5 block text-label-medium text-muted-foreground">
                          {row.username}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      {row.accessRoleCodes.length
                        ? row.accessRoleCodes.join("، ")
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {row.organizationalScopeLabels.length
                        ? row.organizationalScopeLabels.join("، ")
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {row.status === "active" ? "فعال" : "غیرفعال"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="مجموعه‌های مجوز"
        description="کدهای مجوز envelope به‌صورت صریح؛ برچسب نقش درشت اجازهٔ ضمنی نمی‌دهد."
      >
        {permissionSetsQuery.isLoading ? (
          <StatusMessage kind="loading">در حال بارگذاری…</StatusMessage>
        ) : permissionSetsQuery.isError ? (
          <StatusMessage kind="error">
            {permissionSetsQuery.error.message}
          </StatusMessage>
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
              { onError: captureError, onSuccess: () => setSetName("") },
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
          >
            افزودن مجموعه
          </Button>
        </form>
      </Section>

      <Section
        title="محدوده‌های سازمانی"
        description="ایجاد محدوده به‌صورت درخواست entitlement ثبت می‌شود و پس از تأیید مستقل فعال می‌گردد."
      >
        {scopesQuery.isLoading ? (
          <StatusMessage kind="loading">در حال بارگذاری…</StatusMessage>
        ) : scopesQuery.isError ? (
          <StatusMessage kind="error">{scopesQuery.error.message}</StatusMessage>
        ) : (
          <ul className="flex flex-col gap-2 text-body-medium">
            {(scopesQuery.data ?? []).map((scope) => (
              <li key={scope.id} className="border-b border-border/50 py-2">
                {scope.labelFa}
                <span className="ms-2 text-muted-foreground">
                  {scope.active ? "فعال" : "غیرفعال"}
                </span>
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
          >
            درخواست ایجاد محدوده
          </Button>
        </form>
      </Section>

      <Section
        title="نقش‌های دسترسی"
        description="ایجاد نقش به‌صورت درخواست entitlement ثبت می‌شود؛ هر نقش باید به یک مجموعه مجوز متصل باشد."
      >
        {rolesQuery.isLoading ? (
          <StatusMessage kind="loading">در حال بارگذاری…</StatusMessage>
        ) : rolesQuery.isError ? (
          <StatusMessage kind="error">{rolesQuery.error.message}</StatusMessage>
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
          >
            درخواست ایجاد نقش
          </Button>
        </form>
      </Section>

      <Section
        title="پیوند حساب و وضعیت فعال"
        description="حساب را از جدول بالا انتخاب کنید. رمز دایرکتوری ذخیره نمی‌شود."
      >
        <div className="flex flex-col gap-3">
          <div className="flex max-w-md flex-col gap-1">
            <label htmlFor={accountSelectId} className="text-label-medium">
              حساب انتخاب‌شده
            </label>
            <select
              id={accountSelectId}
              className="h-9 rounded-sm border border-input bg-transparent px-3 text-body-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedAccountId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedAccountId(id);
                const row = entitlementsQuery.data?.find(
                  (r) => r.accountId === id,
                );
                setLinkValue(row?.externalDirectoryId ?? "");
                setActionError(null);
              }}
            >
              <option value="">انتخاب کنید</option>
              {(entitlementsQuery.data ?? []).map((row) => (
                <option key={row.accountId} value={row.accountId}>
                  {row.displayName} ({row.username})
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <>
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  setActionError(null);
                  updateLink.mutate(
                    {
                      accountId: selected.accountId,
                      externalDirectoryId: linkValue.trim() || null,
                    },
                    { onError: captureError },
                  );
                }}
              >
                <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                  <label htmlFor={linkId} className="text-label-medium">
                    شناسه دایرکتوری خارجی
                  </label>
                  <Input
                    id={linkId}
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    placeholder="خالی = حذف پیوند"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={updateLink.isPending}
                >
                  ذخیره پیوند
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateLink.isPending}
                  onClick={() => {
                    setActionError(null);
                    updateLink.mutate(
                      {
                        accountId: selected.accountId,
                        externalDirectoryId: null,
                      },
                      {
                        onError: captureError,
                        onSuccess: () => setLinkValue(""),
                      },
                    );
                  }}
                >
                  حذف پیوند
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    setStatus.isPending || selected.status === "active"
                  }
                  onClick={() => {
                    setActionError(null);
                    setStatus.mutate(
                      { accountId: selected.accountId, status: "active" },
                      { onError: captureError },
                    );
                  }}
                >
                  فعال‌سازی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    setStatus.isPending || selected.status === "inactive"
                  }
                  onClick={() => {
                    setActionError(null);
                    setStatus.mutate(
                      { accountId: selected.accountId, status: "inactive" },
                      { onError: captureError },
                    );
                  }}
                >
                  غیرفعال‌سازی
                </Button>
              </div>

              {(rolesQuery.data?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={assignRoles.isPending}
                    onClick={() => {
                      setActionError(null);
                      const first = rolesQuery.data?.[0];
                      if (!first) return;
                      assignRoles.mutate(
                        {
                          accountId: selected.accountId,
                          accessRoleIds: [first.id],
                        },
                        { onError: captureError },
                      );
                    }}
                  >
                    تخصیص نقش اول فهرست
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={assignRoles.isPending}
                    onClick={() => {
                      setActionError(null);
                      assignRoles.mutate(
                        {
                          accountId: selected.accountId,
                          accessRoleIds: [],
                        },
                        { onError: captureError },
                      );
                    }}
                  >
                    حذف همه نقش‌ها
                  </Button>
                </div>
              ) : null}

              {(scopesQuery.data?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={assignScopes.isPending}
                    onClick={() => {
                      setActionError(null);
                      const first = scopesQuery.data?.[0];
                      if (!first) return;
                      assignScopes.mutate(
                        {
                          accountId: selected.accountId,
                          organizationalScopeIds: [first.id],
                        },
                        { onError: captureError },
                      );
                    }}
                  >
                    تخصیص محدوده اول فهرست
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <StatusMessage kind="info">
              برای ویرایش پیوند یا وضعیت، یک حساب انتخاب کنید.
            </StatusMessage>
          )}
        </div>
      </Section>
    </div>
  );
}

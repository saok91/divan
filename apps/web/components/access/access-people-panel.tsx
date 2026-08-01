"use client";

import { useId, useMemo, useState } from "react";

import {
  directoryLinkStatus,
  hasNoEntitlementAssignments,
  joinPersianList,
  normalizeDirectoryLink,
  PEOPLE_SECTION_DEFAULT_FILTERS,
  primaryRoleCode,
} from "@/components/access/access-people-helpers";
import { AccessSection } from "@/components/access/access-section";
import { AccessStatusMessage } from "@/components/access/access-status-message";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { CircleCheck, MapPinned, Shield } from "lucide-react";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type EntitlementRow = {
  accountId: string;
  username: string;
  displayName: string;
  status: string;
  accessRoleIds: string[];
  accessRoleCodes: string[];
  organizationalScopeIds: string[];
  organizationalScopeLabels: string[];
  externalDirectoryId: string | null;
};

type AssignDialogKind = "roles" | "scopes" | null;

export function AccessPeoplePanel() {
  const entitlementsQuery = api.accessAdmin.listEntitlements.useQuery();
  const scopesQuery = api.accessAdmin.listScopes.useQuery();
  const rolesQuery = api.accessAdmin.listRoles.useQuery();

  const utils = api.useUtils();

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

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [assignKind, setAssignKind] = useState<AssignDialogKind>(null);
  const [draftRoleIds, setDraftRoleIds] = useState<string[]>([]);
  const [draftScopeIds, setDraftScopeIds] = useState<string[]>([]);
  const [assignBaseline, setAssignBaseline] = useState<string[]>([]);

  const linkId = useId();
  const leaveGuard = useLeaveGuardOptional();

  const rows = useMemo(
    () => entitlementsQuery.data ?? [],
    [entitlementsQuery.data],
  );
  const selected = rows.find((row) => row.accountId === selectedAccountId);

  const linkDirty =
    selected != null &&
    normalizeDirectoryLink(linkValue) !==
      normalizeDirectoryLink(selected.externalDirectoryId);

  const assignDirty =
    assignKind != null &&
    (assignKind === "roles"
      ? !sameIdSet(draftRoleIds, assignBaseline)
      : !sameIdSet(draftScopeIds, assignBaseline));

  useLeaveGuardRegistration({
    id: "access-people-assign",
    isDirty: linkDirty || assignDirty,
    onDiscard: () => {
      if (selected) {
        setLinkValue(selected.externalDirectoryId ?? "");
      }
      setAssignKind(null);
      setDraftRoleIds([]);
      setDraftScopeIds([]);
      setAssignBaseline([]);
      setSelectionHint(null);
    },
  });

  const assignDialogOpen =
    assignKind != null && leaveGuard?.pending == null;

  function captureError(err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "عملیات انجام نشد.";
    setActionError(message);
  }

  function selectAccount(row: EntitlementRow): boolean {
    if (
      selected != null &&
      row.accountId !== selected.accountId &&
      linkDirty
    ) {
      setSelectionHint(
        "پیوند دایرکتوری ذخیره‌نشده دارد. ابتدا ذخیره یا حذف پیوند کنید، سپس حساب دیگری را انتخاب کنید.",
      );
      return false;
    }
    setSelectedAccountId(row.accountId);
    setLinkValue(row.externalDirectoryId ?? "");
    setActionError(null);
    setSelectionHint(null);
    return true;
  }

  function openRolesDialog(row: EntitlementRow) {
    if (!selectAccount(row)) return;
    const baseline = [...row.accessRoleIds];
    setAssignBaseline(baseline);
    setDraftRoleIds(baseline);
    setAssignKind("roles");
  }

  function openScopesDialog(row: EntitlementRow) {
    if (!selectAccount(row)) return;
    const baseline = [...row.organizationalScopeIds];
    setAssignBaseline(baseline);
    setDraftScopeIds(baseline);
    setAssignKind("scopes");
  }

  const roleEnumOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const role of rolesQuery.data ?? []) codes.add(role.code);
    for (const row of rows) {
      for (const code of row.accessRoleCodes) codes.add(code);
    }
    return [...codes]
      .sort((a, b) => a.localeCompare(b, "fa"))
      .map((value) => ({ value, label: value }));
  }, [rolesQuery.data, rows]);

  const columns = useMemo(
    (): GovernedColumn<EntitlementRow>[] => [
      {
        id: "displayName",
        header: "نام نمایشی",
        accessor: (r) => r.displayName,
        filter: "text",
        sticky: "identifier",
        sortable: true,
        cell: (row) => (
          <button
            type="button"
            className={cn(
              "rounded-sm text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selectedAccountId === row.accountId && "font-medium",
            )}
            onClick={() => selectAccount(row)}
          >
            {row.displayName}
          </button>
        ),
      },
      {
        id: "username",
        header: "حساب",
        accessor: (r) => r.username,
        filter: "text",
        sortable: true,
      },
      {
        id: "roles",
        header: "نقش‌ها",
        accessor: (r) => primaryRoleCode(r.accessRoleCodes),
        filter: "enum",
        enumOptions: roleEnumOptions,
        cell: (r) => joinPersianList(r.accessRoleCodes),
        cellOverflow: "wrap",
        maxWidthClass: "max-w-[14rem]",
      },
      {
        id: "scopes",
        header: "محدوده",
        accessor: (r) => r.organizationalScopeLabels.join("، "),
        filter: "text",
        cell: (r) => joinPersianList(r.organizationalScopeLabels),
        cellOverflow: "wrap",
        maxWidthClass: "max-w-[16rem]",
      },
      {
        id: "status",
        header: "وضعیت",
        accessor: (r) => r.status,
        filter: "enum",
        enumOptions: [
          { value: "active", label: "فعال" },
          { value: "inactive", label: "غیرفعال" },
        ],
        sortable: true,
        cell: (r) => (r.status === "active" ? "فعال" : "غیرفعال"),
      },
      {
        id: "directory",
        header: "پیوند دایرکتوری",
        accessor: (r) => directoryLinkStatus(r.externalDirectoryId),
        filter: "enum",
        enumOptions: [
          { value: "linked", label: "پیوندشده" },
          { value: "unlinked", label: "بدون پیوند" },
        ],
        cell: (r) =>
          directoryLinkStatus(r.externalDirectoryId) === "linked"
            ? "پیوندشده"
            : "بدون پیوند",
      },
    ],
    // selectAccount closes over linkDirty/selected; recreate columns when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid unstable fn identity in deps
    [roleEnumOptions, selectedAccountId, linkDirty, selected?.accountId],
  );

  const showEmptyBanner =
    entitlementsQuery.isSuccess && hasNoEntitlementAssignments(rows);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-small text-foreground">افراد و دسترسی</h1>
        <p className="text-body-large text-muted-foreground">
          ابتدا حساب‌ها را ببینید؛ نقش‌ها، محدوده‌ها و وضعیت از همین جدول خوانده
          می‌شود.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <GlossaryTerm termKey="organizationalScope" />
        </div>
      </header>

      {actionError ? (
        <AccessStatusMessage kind="error">{actionError}</AccessStatusMessage>
      ) : null}

      {selectionHint ? (
        <AccessStatusMessage kind="info">{selectionHint}</AccessStatusMessage>
      ) : null}

      {entitlementsQuery.isLoading ? (
        <AccessStatusMessage kind="loading">
          در حال بارگذاری تخصیص‌ها…
        </AccessStatusMessage>
      ) : entitlementsQuery.isError ? (
        <AccessStatusMessage kind="error">
          {entitlementsQuery.error.message || "بارگذاری تخصیص‌ها ممکن نشد."}
        </AccessStatusMessage>
      ) : (
        <div className="flex flex-col gap-3">
          {showEmptyBanner ? (
            <AccessStatusMessage kind="empty">
              {operationalCopy.emptyEntitlements}
            </AccessStatusMessage>
          ) : null}

          <GovernedDataTable
              aria-label="جدول افراد و دسترسی"
              preferencesKey="access-people"
              columns={columns}
              rows={rows}
              getRowId={(row) => row.accountId}
              sectionDefaultFilters={PEOPLE_SECTION_DEFAULT_FILTERS}
              toolbar={
                <p className="text-body-medium text-muted-foreground">
                  حساب‌ها در مرکز؛ نقش، محدوده و وضعیت از ردیف همان حساب.
                </p>
              }
              rowActions={(row) => (
                <RowActionCluster
                  actions={[
                    {
                      id: "roles",
                      label: "تخصیص نقش",
                      icon: Shield,
                      onSelect: () => openRolesDialog(row),
                    },
                    {
                      id: "scopes",
                      label: "محدوده",
                      icon: MapPinned,
                      onSelect: () => openScopesDialog(row),
                    },
                    {
                      id: "activate",
                      label: "فعال‌سازی",
                      icon: CircleCheck,
                      disabled:
                        setStatus.isPending || row.status === "active",
                      disabledReason:
                        row.status === "active"
                          ? "این حساب از قبل فعال است."
                          : "در حال انجام عملیات…",
                      onSelect: () => {
                        selectAccount(row);
                        setActionError(null);
                        setStatus.mutate(
                          { accountId: row.accountId, status: "active" },
                          { onError: captureError },
                        );
                      },
                    },
                  ]}
                />
              )}
            />
        </div>
      )}

      <AccessSection
        title="پیوند حساب و وضعیت فعال"
        description="حساب را از جدول بالا انتخاب کنید. رمز دایرکتوری ذخیره نمی‌شود."
      >
        {selected ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-medium">
              <span className="font-medium">{selected.displayName}</span>
              <span className="ms-2 text-muted-foreground">
                ({selected.username})
              </span>
            </p>

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
              
            disabledReason={operationalCopy.actionPending}
          >
                ذخیره پیوند
              </Button>
              <Button
                type="button"
                variant="tertiary"
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
              
            disabledReason={operationalCopy.actionPending}
          >
                حذف پیوند
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={setStatus.isPending || selected.status === "active"}
                onClick={() => {
                  setActionError(null);
                  setStatus.mutate(
                    { accountId: selected.accountId, status: "active" },
                    { onError: captureError },
                  );
                }}
              
            disabledReason={operationalCopy.actionPending}
          >
                فعال‌سازی
              </Button>
              <Button
                type="button"
                variant="tertiary"
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
              
            disabledReason={operationalCopy.actionPending}
          >
                غیرفعال‌سازی
              </Button>
            </div>
          </div>
        ) : (
          <AccessStatusMessage kind="info">
            برای ویرایش پیوند یا وضعیت، یک حساب از جدول انتخاب کنید.
          </AccessStatusMessage>
        )}
      </AccessSection>

      <Dialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignKind(null);
            setDraftRoleIds([]);
            setDraftScopeIds([]);
            setAssignBaseline([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignKind === "roles" ? "تخصیص نقش" : "تخصیص محدوده"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.displayName} (${selected.username})`
                : null}
            </DialogDescription>
          </DialogHeader>

          {actionError ? (
            <AccessStatusMessage kind="error">{actionError}</AccessStatusMessage>
          ) : null}

          {assignKind === "roles" ? (
            <div
              className="max-h-60 space-y-1 overflow-y-auto"
              role="group"
              aria-label="نقش‌های دسترسی"
            >
              {rolesQuery.isLoading ? (
                <AccessStatusMessage kind="loading">
                  در حال بارگذاری نقش‌ها…
                </AccessStatusMessage>
              ) : rolesQuery.isError ? (
                <AccessStatusMessage kind="error">
                  {rolesQuery.error.message || "بارگذاری نقش‌ها ممکن نشد."}
                </AccessStatusMessage>
              ) : (rolesQuery.data ?? []).length === 0 ? (
                <AccessStatusMessage kind="empty">
                  نقشی برای تخصیص ثبت نشده.
                </AccessStatusMessage>
              ) : (
                (rolesQuery.data ?? []).map((role) => {
                  const checked = draftRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body-medium hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(state) => {
                          const on = state === true;
                          setDraftRoleIds((prev) =>
                            on
                              ? [...prev, role.id]
                              : prev.filter((id) => id !== role.id),
                          );
                        }}
                        aria-label={role.labelFa}
                      />
                      <span>
                        {role.labelFa}{" "}
                        <span className="text-muted-foreground">
                          ({role.code})
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}

          {assignKind === "scopes" ? (
            <div
              className="max-h-60 space-y-1 overflow-y-auto"
              role="group"
              aria-label="محدوده‌های سازمانی"
            >
              {scopesQuery.isLoading ? (
                <AccessStatusMessage kind="loading">
                  در حال بارگذاری محدوده‌ها…
                </AccessStatusMessage>
              ) : scopesQuery.isError ? (
                <AccessStatusMessage kind="error">
                  {scopesQuery.error.message || "بارگذاری محدوده‌ها ممکن نشد."}
                </AccessStatusMessage>
              ) : (scopesQuery.data ?? []).length === 0 ? (
                <AccessStatusMessage kind="empty">
                  محدوده‌ای برای تخصیص ثبت نشده.
                </AccessStatusMessage>
              ) : (
                (scopesQuery.data ?? []).map((scope) => {
                  const checked = draftScopeIds.includes(scope.id);
                  const selectDisabled = !scope.active && !checked;
                  return (
                    <label
                      key={scope.id}
                      className={cn(
                        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-body-medium",
                        selectDisabled
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={selectDisabled}
                        onCheckedChange={(state) => {
                          const on = state === true;
                          if (on && !scope.active) return;
                          setDraftScopeIds((prev) =>
                            on
                              ? [...prev, scope.id]
                              : prev.filter((id) => id !== scope.id),
                          );
                        }}
                        aria-label={scope.labelFa}
                      />
                      <span>
                        {scope.labelFa}
                        <span className="ms-2 text-muted-foreground">
                          {scope.active ? "فعال" : "غیرفعال"}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAssignKind(null);
                setDraftRoleIds([]);
                setDraftScopeIds([]);
                setAssignBaseline([]);
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={
                !selected ||
                !assignDirty ||
                (assignKind === "roles"
                  ? assignRoles.isPending
                  : assignScopes.isPending)
              }
              onClick={() => {
                if (!selected || !assignKind) return;
                setActionError(null);
                if (assignKind === "roles") {
                  assignRoles.mutate(
                    {
                      accountId: selected.accountId,
                      accessRoleIds: draftRoleIds,
                    },
                    {
                      onError: captureError,
                      onSuccess: () => {
                        setAssignKind(null);
                        setAssignBaseline([]);
                      },
                    },
                  );
                } else {
                  assignScopes.mutate(
                    {
                      accountId: selected.accountId,
                      organizationalScopeIds: draftScopeIds,
                    },
                    {
                      onError: captureError,
                      onSuccess: () => {
                        setAssignKind(null);
                        setAssignBaseline([]);
                      },
                    },
                  );
                }
              }}
            
            disabledReason={operationalCopy.actionPending}
          >
              ذخیره تخصیص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

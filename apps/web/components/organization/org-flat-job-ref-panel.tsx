"use client";

import * as React from "react";

import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, CircleCheck, Pencil } from "lucide-react";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

export type FlatJobRefConcept = "role" | "jobTitle" | "seniority";

type RefRow = {
  id: string;
  code: string;
  nameFa: string;
  active: boolean;
  status: "active" | "inactive";
};

export const FLAT_REF_SECTION_DEFAULT_FILTERS: Record<
  string,
  string | string[]
> = {
  status: ["active"],
};

const CONCEPT_LABEL: Record<FlatJobRefConcept, string> = {
  role: "نقش سازمانی",
  jobTitle: "عنوان شغلی",
  seniority: "ارشدیت",
};

const EMPTY_COPY: Record<FlatJobRefConcept, string> = {
  role: operationalCopy.jobRefRolesEmpty,
  jobTitle: operationalCopy.jobRefJobTitlesEmpty,
  seniority: operationalCopy.jobRefSenioritiesEmpty,
};

type ModalMode = "create" | "edit" | "deactivate" | null;

/**
 * Shared flat GovernedDataTable panel for role / job-title / seniority.
 */
export function OrgFlatJobRefPanel({ concept }: { concept: FlatJobRefConcept }) {
  const formId = React.useId();
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();
  const label = CONCEPT_LABEL[concept];

  const [modal, setModal] = React.useState<ModalMode>(null);
  const [editTarget, setEditTarget] = React.useState<RefRow | null>(null);
  const [code, setCode] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [startDate, setStartDate] = React.useState<string | undefined>();
  const [deactivateEnd, setDeactivateEnd] = React.useState<
    string | undefined
  >();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [baseline, setBaseline] = React.useState({ code: "", nameFa: "" });

  const rolesQuery = api.jobReference.listRoles.useQuery(
    { includeInactive: true },
    { enabled: concept === "role" },
  );
  const titlesQuery = api.jobReference.listJobTitles.useQuery(
    { includeInactive: true },
    { enabled: concept === "jobTitle" },
  );
  const senioritiesQuery = api.jobReference.listSeniorities.useQuery(
    { includeInactive: true },
    { enabled: concept === "seniority" },
  );

  const listQuery =
    concept === "role"
      ? rolesQuery
      : concept === "jobTitle"
        ? titlesQuery
        : senioritiesQuery;

  const rows = React.useMemo((): RefRow[] => {
    return (listQuery.data ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      nameFa: r.nameFa,
      active: r.active,
      status: r.active ? ("active" as const) : ("inactive" as const),
    }));
  }, [listQuery.data]);

  const createDirty =
    modal === "create" &&
    (code.trim() !== "" || nameFa.trim() !== "" || Boolean(startDate));
  const editDirty =
    modal === "edit" &&
    (code.trim() !== baseline.code || nameFa.trim() !== baseline.nameFa);

  useLeaveGuardRegistration({
    id: `org-flat-${concept}-modal`,
    isDirty: createDirty || editDirty,
    onDiscard: () => {
      resetForm();
      setModal(null);
      setEditTarget(null);
    },
  });

  const dialogOpen = modal !== null && leaveGuard?.pending == null;

  function resetForm() {
    setCode("");
    setNameFa("");
    setStartDate(undefined);
    setDeactivateEnd(undefined);
    setFormError(null);
    setBaseline({ code: "", nameFa: "" });
  }

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      utils.jobReference.listRoles.invalidate(),
      utils.jobReference.listJobTitles.invalidate(),
      utils.jobReference.listSeniorities.invalidate(),
    ]);
  }, [utils]);

  const createRole = api.jobReference.createRole.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const createJobTitle = api.jobReference.createJobTitle.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const createSeniority = api.jobReference.createSeniority.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  const updateRole = api.jobReference.updateRoleIdentity.useMutation();
  const updateJobTitle = api.jobReference.updateJobTitleIdentity.useMutation();
  const updateSeniority = api.jobReference.updateSeniorityIdentity.useMutation();

  const activateRole = api.jobReference.activateRole.useMutation({
    onSuccess: invalidate,
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const activateJobTitle = api.jobReference.activateJobTitle.useMutation({
    onSuccess: invalidate,
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const activateSeniority = api.jobReference.activateSeniority.useMutation({
    onSuccess: invalidate,
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  const deactivateRole = api.jobReference.deactivateRole.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTarget(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const deactivateJobTitle = api.jobReference.deactivateJobTitle.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTarget(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const deactivateSeniority = api.jobReference.deactivateSeniority.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTarget(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  function openEdit(row: RefRow) {
    resetForm();
    setEditTarget(row);
    setCode(row.code);
    setNameFa(row.nameFa);
    setBaseline({ code: row.code, nameFa: row.nameFa });
    setModal("edit");
  }

  function openDeactivate(row: RefRow) {
    resetForm();
    setEditTarget(row);
    setModal("deactivate");
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !nameFa.trim() || !startDate) {
      setFormError("کد، نام و تاریخ شروع الزامی است.");
      return;
    }
    const base = {
      code: code.trim(),
      nameFa: nameFa.trim(),
      startDate,
    };
    if (concept === "role") createRole.mutate(base);
    else if (concept === "jobTitle") createJobTitle.mutate(base);
    else createSeniority.mutate(base);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setFormError(null);
    if (!code.trim() || !nameFa.trim()) {
      setFormError("کد و نام الزامی است.");
      return;
    }
    try {
      const payload = {
        id: editTarget.id,
        code: code.trim(),
        nameFa: nameFa.trim(),
      };
      if (concept === "role") await updateRole.mutateAsync(payload);
      else if (concept === "jobTitle")
        await updateJobTitle.mutateAsync(payload);
      else await updateSeniority.mutateAsync(payload);
      resetForm();
      setModal(null);
      setEditTarget(null);
      await invalidate();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : operationalCopy.jobRefActionFailed;
      setFormError(message);
    }
  }

  const columns = React.useMemo(
    (): GovernedColumn<RefRow>[] => [
      {
        id: "code",
        header: "کد",
        accessor: (r) => r.code,
        filter: "text",
        sticky: "identifier",
        sortable: true,
        cell: (row) => toPersianDigits(row.code),
      },
      {
        id: "nameFa",
        header: "نام",
        accessor: (r) => r.nameFa,
        filter: "text",
        sortable: true,
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
        cell: (row) => (row.active ? "فعال" : "غیرفعال"),
      },
    ],
    [],
  );

  const creating =
    createRole.isPending ||
    createJobTitle.isPending ||
    createSeniority.isPending;

  const editSaving =
    updateRole.isPending ||
    updateJobTitle.isPending ||
    updateSeniority.isPending;

  const busyId =
    activateRole.isPending
      ? (activateRole.variables?.id ?? null)
      : activateJobTitle.isPending
        ? (activateJobTitle.variables?.id ?? null)
        : activateSeniority.isPending
          ? (activateSeniority.variables?.id ?? null)
          : deactivateRole.isPending
            ? (deactivateRole.variables?.id ?? null)
            : deactivateJobTitle.isPending
              ? (deactivateJobTitle.variables?.id ?? null)
              : deactivateSeniority.isPending
                ? (deactivateSeniority.variables?.id ?? null)
                : null;

  const deactivating =
    deactivateRole.isPending ||
    deactivateJobTitle.isPending ||
    deactivateSeniority.isPending;

  return (
    <section className="space-y-6" aria-labelledby={`${formId}-heading`}>
      <header className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-subtitle text-foreground">
          {label}
        </h2>
      </header>

      {formError && modal === null ? (
        <p role="alert" className="text-body text-destructive">
          {formError}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
        </div>
      ) : listQuery.isError ? (
        <p role="alert" className="text-body text-destructive">
          {operationalCopy.jobRefListError}
        </p>
      ) : (
        <GovernedDataTable
          aria-label={`جدول ${label}`}
          preferencesKey={`org-flat-${concept}`}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          sectionDefaultFilters={FLAT_REF_SECTION_DEFAULT_FILTERS}
          emptyMessage={EMPTY_COPY[concept]}
          emptyAction={{
            labelFa: "افزودن",
            onClick: () => {
              resetForm();
              setModal("create");
            },
          }}
          toolbar={
            <Button
              type="button"
              onClick={() => {
                resetForm();
                setModal("create");
              }}
            >
              افزودن
            </Button>
          }
          rowActions={(row) => (
            <RowActionCluster
              actions={[
                {
                  id: "edit",
                  label: "ویرایش",
                  icon: Pencil,
                  onSelect: () => openEdit(row),
                },
                row.active
                  ? {
                      id: "deactivate",
                      label: "غیرفعال‌سازی",
                      icon: Ban,
                      disabled: busyId === row.id,
                      disabledReason: "در حال انجام عملیات…",
                      onSelect: () => openDeactivate(row),
                    }
                  : {
                      id: "activate",
                      label: "فعال‌سازی",
                      icon: CircleCheck,
                      disabled: busyId === row.id,
                      disabledReason: "در حال انجام عملیات…",
                      onSelect: () => {
                        setFormError(null);
                        if (concept === "role")
                          activateRole.mutate({ id: row.id });
                        else if (concept === "jobTitle")
                          activateJobTitle.mutate({ id: row.id });
                        else activateSeniority.mutate({ id: row.id });
                      },
                    },
              ]}
            />
          )}
        />
      )}

      <Dialog
        open={dialogOpen && modal === "create"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitCreate} noValidate>
            <DialogHeader>
              <DialogTitle>افزودن {label}</DialogTitle>
              <DialogDescription>ایجاد مرجع جدید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-caption">تاریخ شروع</span>
                <JalaliDatePicker
                  aria-label={`تاریخ شروع ${label}`}
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
            </div>
            {formError ? (
              <p role="alert" className="text-body text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setModal(null);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={creating}
            disabledReason={operationalCopy.actionPending}
          >
                ایجاد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen && modal === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitEdit} noValidate>
            <DialogHeader>
              <DialogTitle>ویرایش {label}</DialogTitle>
              <DialogDescription>به‌روزرسانی هویت.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-e-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-e-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-e-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-e-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                />
              </div>
            </div>
            {formError ? (
              <p role="alert" className="text-body text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setModal(null);
                  setEditTarget(null);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={editSaving}
            disabledReason={operationalCopy.actionPending}
          >
                ذخیره
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen && modal === "deactivate"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>غیرفعال‌سازی {label}</DialogTitle>
            <DialogDescription>
              رکورد حذف نمی‌شود؛ بازه اعتبار بسته می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <span className="text-caption">تاریخ پایان اعتبار</span>
            <JalaliDatePicker
              aria-label="تاریخ پایان اعتبار"
              value={deactivateEnd}
              onChange={setDeactivateEnd}
            />
          </div>
          {formError ? (
            <p role="alert" className="text-body text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setModal(null);
                setEditTarget(null);
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={!editTarget || !deactivateEnd || deactivating}
              onClick={() => {
                if (!editTarget || !deactivateEnd) {
                  setFormError(operationalCopy.orgDeactivateEndRequired);
                  return;
                }
                setFormError(null);
                const payload = {
                  id: editTarget.id,
                  endDateExclusive: deactivateEnd,
                };
                if (concept === "role") deactivateRole.mutate(payload);
                else if (concept === "jobTitle")
                  deactivateJobTitle.mutate(payload);
                else deactivateSeniority.mutate(payload);
              }}
            
            disabledReason={operationalCopy.actionPending}
          >
              تأیید غیرفعال‌سازی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

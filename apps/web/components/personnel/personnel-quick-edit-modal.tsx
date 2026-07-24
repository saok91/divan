"use client";

import * as React from "react";

import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import type { PersonnelListRow } from "@/components/personnel/personnel-list-types";
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
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

type PersonFieldKey = "givenName" | "familyName" | "mobilePhone";

type FieldErrors = Partial<Record<PersonFieldKey | "form", string>>;

type SavedPerson = {
  id: string;
  givenName: string;
  familyName: string;
  mobilePhone: string;
};

type PersonnelQuickEditModalProps = {
  open: boolean;
  row: PersonnelListRow;
  onOpenChange: (open: boolean) => void;
  onSaved: (person: SavedPerson) => void;
};

const PROFILE_HREF_PLACEHOLDER = "/personnel/list";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/**
 * personnel-quick-edit-modal — non-event identity fields only (UX-DR28 / Story 4b.7).
 * Parent should remount with `key={row.id}` when opening a different row.
 */
export function PersonnelQuickEditModal({
  open,
  row,
  onOpenChange,
  onSaved,
}: PersonnelQuickEditModalProps) {
  const formId = React.useId();
  const leaveGuard = useLeaveGuardOptional();
  const [givenName, setGivenName] = React.useState(row.givenName);
  const [familyName, setFamilyName] = React.useState(row.familyName);
  const [mobilePhone, setMobilePhone] = React.useState(row.mobilePhone ?? "");
  const [baseline, setBaseline] = React.useState({
    givenName: row.givenName,
    familyName: row.familyName,
    mobilePhone: row.mobilePhone ?? "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const enabledQuery = api.person.listEnabledFields.useQuery(undefined, {
    enabled: open,
  });

  const enabledKeys = React.useMemo(() => {
    const set = new Set<PersonFieldKey>();
    for (const f of enabledQuery.data ?? []) {
      if (
        f.personFieldKey === "givenName" ||
        f.personFieldKey === "familyName" ||
        f.personFieldKey === "mobilePhone"
      ) {
        set.add(f.personFieldKey);
      }
    }
    return set;
  }, [enabledQuery.data]);

  /** Gate on modal intent (`open`), not dialog visibility — leave-guard hides UI but must keep isDirty. */
  const dirty =
    open &&
    (givenName !== baseline.givenName ||
      familyName !== baseline.familyName ||
      mobilePhone !== baseline.mobilePhone);

  function restoreBaseline() {
    setGivenName(baseline.givenName);
    setFamilyName(baseline.familyName);
    setMobilePhone(baseline.mobilePhone);
    setFieldErrors({});
  }

  const updateMutation = api.person.updateIdentity.useMutation();

  const onSave = React.useCallback(async (): Promise<boolean> => {
    if (!isUuid(row.id)) {
      setFieldErrors({
        form: "این ردیف اسکفولد است؛ ذخیره هویت واقعی پس از اتصال فهرست در داستان ۵.۱ فعال می‌شود.",
      });
      return false;
    }
    if (enabledQuery.isLoading || enabledQuery.isError) {
      setFieldErrors({
        form: enabledQuery.isError
          ? enabledQuery.error.message || operationalCopy.personFieldsError
          : operationalCopy.personFieldsLoading,
      });
      return false;
    }
    try {
      const result = await updateMutation.mutateAsync({
        id: row.id,
        ...(enabledKeys.has("givenName")
          ? { givenName: givenName.trim() }
          : {}),
        ...(enabledKeys.has("familyName")
          ? { familyName: familyName.trim() }
          : {}),
        ...(enabledKeys.has("mobilePhone")
          ? { mobilePhone: mobilePhone.trim() }
          : {}),
      });
      const saved: SavedPerson = {
        id: row.id,
        givenName: result.givenName ?? givenName.trim(),
        familyName: result.familyName ?? familyName.trim(),
        mobilePhone: result.mobilePhone ?? mobilePhone.trim(),
      };
      setBaseline({
        givenName: saved.givenName,
        familyName: saved.familyName,
        mobilePhone: saved.mobilePhone,
      });
      setFieldErrors({});
      onSaved(saved);
      return true;
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : operationalCopy.personActionFailed;
      const code =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { divanCode?: string } }).data?.divanCode
          : undefined;
      if (code === "MOBILE_PHONE_FORMAT") {
        setFieldErrors({ mobilePhone: message });
      } else {
        setFieldErrors({ form: message });
      }
      return false;
    }
  }, [
    row.id,
    givenName,
    familyName,
    mobilePhone,
    updateMutation,
    onSaved,
    enabledKeys,
    enabledQuery.isLoading,
    enabledQuery.isError,
    enabledQuery.error,
  ]);

  useLeaveGuardRegistration({
    id: "personnel-quick-edit-modal",
    isDirty: dirty,
    onSave,
    onDiscard: () => {
      restoreBaseline();
      onOpenChange(false);
    },
  });

  function requestCloseOrGuard() {
    if (dirty && leaveGuard) {
      void leaveGuard.requestNavigation(
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/personnel/list",
      );
      return;
    }
    restoreBaseline();
    onOpenChange(false);
  }

  function onProfileLinkClick(e: React.MouseEvent) {
    if (!dirty) return;
    e.preventDefault();
    if (leaveGuard) {
      void leaveGuard.requestNavigation(PROFILE_HREF_PLACEHOLDER);
      return;
    }
    onOpenChange(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (enabledKeys.has("givenName") && !givenName.trim()) {
      next.givenName = operationalCopy.personGivenNameRequired;
    }
    if (enabledKeys.has("familyName") && !familyName.trim()) {
      next.familyName = operationalCopy.personFamilyNameRequired;
    }
    if (enabledKeys.has("mobilePhone") && !mobilePhone.trim()) {
      next.mobilePhone = operationalCopy.personMobileRequired;
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    const ok = await onSave();
    if (ok) onOpenChange(false);
  }

  const busy = updateMutation.isPending;
  const dialogVisible = open && leaveGuard?.pending == null;

  return (
    <Dialog
      open={dialogVisible}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestCloseOrGuard();
      }}
    >
      <DialogContent
        className="sm:max-w-3xl"
        showCloseButton={!dirty}
        onEscapeKeyDown={(e) => {
          if (dirty) {
            e.preventDefault();
            requestCloseOrGuard();
          }
        }}
        onPointerDownOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
      >
        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>اطلاعات کامل / ویرایش</DialogTitle>
            <DialogDescription>
              ویرایش فیلدهای هویت غیررویدادی. ثبت رویداد شغلی از این پنجره انجام
              نمی‌شود.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-3 sm:grid-cols-2">
            <p className="text-caption text-muted-foreground sm:col-span-2">
              کد پرسنلی:{" "}
              <span className="text-tabular" dir="ltr">
                {row.personnelCode}
              </span>
            </p>

            {enabledKeys.has("givenName") ? (
              <div className="space-y-1">
                <label htmlFor={`${formId}-given`} className="text-body">
                  نام
                </label>
                <Input
                  id={`${formId}-given`}
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  disabled={busy}
                />
                {fieldErrors.givenName ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.givenName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {enabledKeys.has("familyName") ? (
              <div className="space-y-1">
                <label htmlFor={`${formId}-family`} className="text-body">
                  نام خانوادگی
                </label>
                <Input
                  id={`${formId}-family`}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={busy}
                />
                {fieldErrors.familyName ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.familyName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {enabledKeys.has("mobilePhone") ? (
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`${formId}-mobile`} className="text-body">
                  موبایل
                </label>
                <Input
                  id={`${formId}-mobile`}
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  dir="ltr"
                  className="text-tabular"
                  inputMode="tel"
                  disabled={busy}
                />
                {fieldErrors.mobilePhone ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.mobilePhone}
                  </p>
                ) : null}
              </div>
            ) : null}

            {fieldErrors.form ? (
              <p
                className="text-body text-destructive sm:col-span-2"
                role="alert"
              >
                {fieldErrors.form}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={PROFILE_HREF_PLACEHOLDER}
              className="text-body text-accent underline-offset-4 hover:underline"
              onClick={onProfileLinkClick}
            >
              باز کردن پروفایل کامل
            </a>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "در حال ذخیره…" : "ذخیره"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={requestCloseOrGuard}
              >
                انصراف
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

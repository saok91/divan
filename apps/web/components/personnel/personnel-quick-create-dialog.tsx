"use client";

import * as React from "react";

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
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type PersonFieldKey =
  | "personnelCode"
  | "givenName"
  | "familyName"
  | "mobilePhone";

type FieldErrors = Partial<Record<PersonFieldKey | "form", string>>;

type CreatedPerson = {
  id: string;
  personnelCode: string;
  givenName: string;
  familyName: string;
  mobilePhone: string;
};

type PersonnelQuickCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (person: CreatedPerson) => void;
};

/**
 * Minimal-create dialog — dictionary-enabled Person fields → person.create (Story 4b.7).
 */
export function PersonnelQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: PersonnelQuickCreateDialogProps) {
  const formId = React.useId();
  const leaveGuard = useLeaveGuardOptional();
  const [personnelCode, setPersonnelCode] = React.useState("");
  const [givenName, setGivenName] = React.useState("");
  const [familyName, setFamilyName] = React.useState("");
  const [mobilePhone, setMobilePhone] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const enabledQuery = api.person.listEnabledFields.useQuery(undefined, {
    enabled: open,
  });

  const enabledKeys = React.useMemo(() => {
    const set = new Set<PersonFieldKey>();
    for (const f of enabledQuery.data ?? []) {
      if (
        f.personFieldKey === "personnelCode" ||
        f.personFieldKey === "givenName" ||
        f.personFieldKey === "familyName" ||
        f.personFieldKey === "mobilePhone"
      ) {
        set.add(f.personFieldKey);
      }
    }
    return set;
  }, [enabledQuery.data]);

  const show = (key: PersonFieldKey) => enabledKeys.has(key);

  /** Gate on modal intent (`open`), not dialog visibility — leave-guard hides UI but must keep isDirty. */
  const dirty =
    open &&
    (personnelCode.trim() !== "" ||
      givenName.trim() !== "" ||
      familyName.trim() !== "" ||
      mobilePhone.trim() !== "");

  function reset() {
    setPersonnelCode("");
    setGivenName("");
    setFamilyName("");
    setMobilePhone("");
    setFieldErrors({});
  }

  useLeaveGuardRegistration({
    id: "personnel-quick-create",
    isDirty: dirty,
    onDiscard: () => {
      reset();
      onOpenChange(false);
    },
  });

  const createMutation = api.person.create.useMutation({
    onSuccess: (row) => {
      if (!row.id) {
        setFieldErrors({ form: operationalCopy.personActionFailed });
        return;
      }
      const created: CreatedPerson = {
        id: row.id,
        personnelCode: row.personnelCode ?? personnelCode.trim(),
        givenName: row.givenName ?? givenName.trim(),
        familyName: row.familyName ?? familyName.trim(),
        mobilePhone: row.mobilePhone ?? mobilePhone.trim(),
      };
      reset();
      onCreated(created);
    },
    onError: (err) => {
      const code = err.data?.divanCode;
      if (code === "DUPLICATE_PERSONNEL_CODE") {
        setFieldErrors({ personnelCode: err.message });
        return;
      }
      if (code === "MOBILE_PHONE_FORMAT") {
        setFieldErrors({ mobilePhone: err.message });
        return;
      }
      if (code === "FIELD_NOT_ENABLED" || code === "DUPLICATE_NATIONAL_ID") {
        setFieldErrors({ form: err.message });
        return;
      }
      setFieldErrors({
        form: err.message || operationalCopy.personActionFailed,
      });
    },
  });

  function validate(): boolean {
    const next: FieldErrors = {};
    if (show("personnelCode") && !personnelCode.trim()) {
      next.personnelCode = operationalCopy.personPersonnelCodeRequired;
    }
    if (show("givenName") && !givenName.trim()) {
      next.givenName = operationalCopy.personGivenNameRequired;
    }
    if (show("familyName") && !familyName.trim()) {
      next.familyName = operationalCopy.personFamilyNameRequired;
    }
    if (show("mobilePhone") && !mobilePhone.trim()) {
      next.mobilePhone = operationalCopy.personMobileRequired;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const required: PersonFieldKey[] = [
      "personnelCode",
      "givenName",
      "familyName",
      "mobilePhone",
    ];
    if (!required.every((k) => show(k))) {
      setFieldErrors({ form: operationalCopy.personCreateFieldsDisabled });
      return;
    }
    createMutation.mutate({
      personnelCode: personnelCode.trim(),
      givenName: givenName.trim(),
      familyName: familyName.trim(),
      mobilePhone: mobilePhone.trim(),
    });
  }

  const busy = createMutation.isPending;
  const dialogVisible = open && leaveGuard?.pending == null;

  return (
    <Dialog
      open={dialogVisible}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        if (dirty && leaveGuard) {
          void leaveGuard.requestNavigation(
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "/personnel/list",
          );
          return;
        }
        reset();
        onOpenChange(false);
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!dirty}
        onEscapeKeyDown={(e) => {
          if (!dirty) return;
          e.preventDefault();
          if (leaveGuard) {
            void leaveGuard.requestNavigation(
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : "/personnel/list",
            );
            return;
          }
          reset();
          onOpenChange(false);
        }}
        onPointerDownOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>افزودن سریع</DialogTitle>
            <DialogDescription>
              ایجاد هویت پایدار با فیلدهای تأییدشده فرهنگ‌داده.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-3">
            {enabledQuery.isLoading ? (
              <p className="text-body text-muted-foreground" role="status">
                {operationalCopy.personFieldsLoading}
              </p>
            ) : null}
            {enabledQuery.isError ? (
              <p className="text-body text-destructive" role="alert">
                {enabledQuery.error.message ||
                  operationalCopy.personFieldsError}
              </p>
            ) : null}

            {show("personnelCode") ? (
              <div className="space-y-1">
                <label htmlFor={`${formId}-code`} className="text-body">
                  کد پرسنلی
                </label>
                <Input
                  id={`${formId}-code`}
                  value={personnelCode}
                  onChange={(e) => setPersonnelCode(e.target.value)}
                  dir="ltr"
                  className="text-tabular"
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.personnelCode)}
                />
                {fieldErrors.personnelCode ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.personnelCode}
                  </p>
                ) : null}
              </div>
            ) : null}

            {show("givenName") ? (
              <div className="space-y-1">
                <label htmlFor={`${formId}-given`} className="text-body">
                  نام
                </label>
                <Input
                  id={`${formId}-given`}
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.givenName)}
                />
                {fieldErrors.givenName ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.givenName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {show("familyName") ? (
              <div className="space-y-1">
                <label htmlFor={`${formId}-family`} className="text-body">
                  نام خانوادگی
                </label>
                <Input
                  id={`${formId}-family`}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.familyName)}
                />
                {fieldErrors.familyName ? (
                  <p className="text-caption text-destructive" role="alert">
                    {fieldErrors.familyName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {show("mobilePhone") ? (
              <div className="space-y-1">
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
                  aria-invalid={Boolean(fieldErrors.mobilePhone)}
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
                className={cn("text-body text-destructive")}
                role="alert"
              >
                {fieldErrors.form}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" variant="primary" disabled={busy}
            disabledReason={operationalCopy.actionPending}
          >
              {busy ? "در حال ایجاد…" : "ایجاد"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (dirty && leaveGuard) {
                  void leaveGuard.requestNavigation(
                    typeof window !== "undefined"
                      ? window.location.pathname + window.location.search
                      : "/personnel/list",
                  );
                  return;
                }
                reset();
                onOpenChange(false);
              }}
            
            disabledReason={operationalCopy.actionPending}
          >
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

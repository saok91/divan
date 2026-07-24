"use client";

import * as React from "react";

import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { CurrentPersonStateForeshadow } from "@/components/personnel/current-person-state-foreshadow";
import { Button } from "@/components/ui/button";
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

/**
 * Full create form on افزودن tab — extracted from PersonnelPanel (Story 4b.7).
 */
export function PersonnelAddPanel() {
  const formId = React.useId();
  const [personnelCode, setPersonnelCode] = React.useState("");
  const [givenName, setGivenName] = React.useState("");
  const [familyName, setFamilyName] = React.useState("");
  const [mobilePhone, setMobilePhone] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const utils = api.useUtils();
  const enabledQuery = api.person.listEnabledFields.useQuery();

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

  const dirty =
    personnelCode.trim() !== "" ||
    givenName.trim() !== "" ||
    familyName.trim() !== "" ||
    mobilePhone.trim() !== "";

  const createMutation = api.person.create.useMutation({
    onSuccess: async () => {
      setPersonnelCode("");
      setGivenName("");
      setFamilyName("");
      setMobilePhone("");
      setFieldErrors({});
      await utils.person.list.invalidate();
    },
    onError: (err) => {
      const code = err.data?.divanCode;
      if (code === "DUPLICATE_PERSONNEL_CODE") {
        setFieldErrors({ personnelCode: err.message });
        return;
      }
      if (code === "DUPLICATE_NATIONAL_ID") {
        setFieldErrors({ form: err.message });
        return;
      }
      if (code === "MOBILE_PHONE_FORMAT") {
        setFieldErrors({ mobilePhone: err.message });
        return;
      }
      if (code === "FIELD_NOT_ENABLED") {
        setFieldErrors({ form: err.message });
        return;
      }
      setFieldErrors({
        form: err.message || operationalCopy.personActionFailed,
      });
    },
  });

  useLeaveGuardRegistration({
    id: "personnel-add-form",
    isDirty: dirty,
    onDiscard: () => {
      setPersonnelCode("");
      setGivenName("");
      setFamilyName("");
      setMobilePhone("");
      setFieldErrors({});
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-foreground">
      <header className="space-y-2">
        <h2 className="text-heading-sm">افزودن پرسنل</h2>
        <p className="text-body text-muted-foreground">
          ایجاد هویت پایدار پرسنل با فیلدهای تأییدشده فرهنگ‌داده.
        </p>
      </header>

      {enabledQuery.isLoading ? (
        <p className="text-body text-muted-foreground" role="status">
          {operationalCopy.personFieldsLoading}
        </p>
      ) : null}
      {enabledQuery.isError ? (
        <p className="text-body text-destructive" role="alert">
          {enabledQuery.error.message || operationalCopy.personFieldsError}
        </p>
      ) : null}

      {!enabledQuery.isLoading && !enabledQuery.isError ? (
        <form className="space-y-4" onSubmit={onSubmit} noValidate aria-busy={busy}>
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

          {(show("givenName") || show("familyName")) && (
            <div className="grid gap-4 sm:grid-cols-2">
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
                  />
                  {fieldErrors.familyName ? (
                    <p className="text-caption text-destructive" role="alert">
                      {fieldErrors.familyName}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

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
              />
              {fieldErrors.mobilePhone ? (
                <p className="text-caption text-destructive" role="alert">
                  {fieldErrors.mobilePhone}
                </p>
              ) : null}
            </div>
          ) : null}

          {fieldErrors.form ? (
            <p className={cn("text-body text-destructive")} role="alert">
              {fieldErrors.form}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "در حال ایجاد…" : "ایجاد پرسنل"}
          </Button>
        </form>
      ) : null}

      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-body text-muted-foreground">
          ابزار پیش‌نمایش وضعیت شخص (اسکفولد)
        </summary>
        <div className="mt-3">
          <CurrentPersonStateForeshadow />
        </div>
      </details>
    </div>
  );
}

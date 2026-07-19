"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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
        "text-body",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

type FieldErrors = {
  personnelCode?: string;
  givenName?: string;
  familyName?: string;
  mobilePhone?: string;
  form?: string;
};

type PersonFieldKey =
  | "personnelCode"
  | "givenName"
  | "familyName"
  | "mobilePhone";

/**
 * Thin Person create + list panel (Stories 3.1 / 3.3).
 * Only dictionary-enabled approve fields are rendered in the DOM (not CSS-hidden).
 * Not Epic 5 personnel-data-table / search / full profile.
 */
export function PersonnelPanel() {
  const formId = React.useId();
  const [personnelCode, setPersonnelCode] = React.useState("");
  const [givenName, setGivenName] = React.useState("");
  const [familyName, setFamilyName] = React.useState("");
  const [mobilePhone, setMobilePhone] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const utils = api.useUtils();
  const listQuery = api.person.list.useQuery();
  const enabledQuery = api.person.listEnabledFields.useQuery();
  const dictionaryQuery = api.person.listDictionary.useQuery();

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

  const show = (key: PersonFieldKey): boolean => enabledKeys.has(key);

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
      setFieldErrors({ form: err.message || operationalCopy.personActionFailed });
    },
  });

  const updateMutation = api.person.updateIdentity.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      setGivenName("");
      setFamilyName("");
      setMobilePhone("");
      setFieldErrors({});
      await utils.person.list.invalidate();
    },
    onError: (err) => {
      const code = err.data?.divanCode;
      if (code === "MOBILE_PHONE_FORMAT") {
        setFieldErrors({ mobilePhone: err.message });
        return;
      }
      if (code === "FIELD_NOT_ENABLED") {
        setFieldErrors({ form: err.message });
        return;
      }
      setFieldErrors({ form: err.message || operationalCopy.personActionFailed });
    },
  });

  function validate(): boolean {
    const next: FieldErrors = {};
    if (show("personnelCode") && !personnelCode.trim() && !editingId) {
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

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...(show("givenName") ? { givenName: givenName.trim() } : {}),
        ...(show("familyName") ? { familyName: familyName.trim() } : {}),
        ...(show("mobilePhone") ? { mobilePhone: mobilePhone.trim() } : {}),
      });
      return;
    }

    const createRequired: PersonFieldKey[] = [
      "personnelCode",
      "givenName",
      "familyName",
      "mobilePhone",
    ];
    if (!createRequired.every((k) => show(k))) {
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

  function startEdit(row: {
    id: string;
    givenName?: string;
    familyName?: string;
    mobilePhone?: string;
  }) {
    setEditingId(row.id);
    setGivenName(row.givenName ?? "");
    setFamilyName(row.familyName ?? "");
    setMobilePhone(row.mobilePhone ?? "");
    setPersonnelCode("");
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setGivenName("");
    setFamilyName("");
    setMobilePhone("");
    setPersonnelCode("");
    setFieldErrors({});
  }

  const busy = createMutation.isPending || updateMutation.isPending;
  const fieldsLoading = enabledQuery.isLoading;

  return (
    <div className="mx-auto max-w-3xl space-y-8 text-foreground">
      <header className="space-y-2">
        <h1 className="text-heading">اطلاعات پرسنلی</h1>
        <p className="text-body text-muted-foreground">
          ایجاد و نگهداری هویت پایدار پرسنل با فیلدهای تأییدشده فرهنگ‌داده.
        </p>
      </header>

      <section
        className="space-y-4"
        aria-labelledby={`${formId}-create-heading`}
      >
        <h2 id={`${formId}-create-heading`} className="text-heading-sm">
          {editingId ? "ویرایش هویت پرسنل" : "ایجاد پرسنل"}
        </h2>

        {fieldsLoading ? (
          <StatusMessage kind="loading">
            {operationalCopy.personFieldsLoading}
          </StatusMessage>
        ) : null}

        {enabledQuery.isError ? (
          <StatusMessage kind="error">
            {enabledQuery.error.message || operationalCopy.personFieldsError}
          </StatusMessage>
        ) : null}

        {!fieldsLoading && !enabledQuery.isError ? (
          <form
            className="space-y-4"
            onSubmit={onSubmit}
            noValidate
            aria-busy={busy}
          >
            {!editingId && show("personnelCode") ? (
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-code`}
                  className="text-body text-foreground"
                >
                  کد پرسنلی
                </label>
                <Input
                  id={`${formId}-code`}
                  name="personnelCode"
                  value={personnelCode}
                  onChange={(e) => setPersonnelCode(e.target.value)}
                  autoComplete="off"
                  dir="ltr"
                  className="text-tabular"
                  aria-invalid={Boolean(fieldErrors.personnelCode)}
                  aria-describedby={
                    fieldErrors.personnelCode
                      ? `${formId}-code-error`
                      : undefined
                  }
                  disabled={busy}
                />
                {fieldErrors.personnelCode ? (
                  <p
                    id={`${formId}-code-error`}
                    role="alert"
                    className="text-caption text-destructive"
                  >
                    {fieldErrors.personnelCode}
                  </p>
                ) : null}
              </div>
            ) : null}

            {show("givenName") || show("familyName") ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {show("givenName") ? (
                  <div className="space-y-1">
                    <label
                      htmlFor={`${formId}-given`}
                      className="text-body text-foreground"
                    >
                      نام
                    </label>
                    <Input
                      id={`${formId}-given`}
                      name="givenName"
                      value={givenName}
                      onChange={(e) => setGivenName(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.givenName)}
                      aria-describedby={
                        fieldErrors.givenName
                          ? `${formId}-given-error`
                          : undefined
                      }
                      disabled={busy}
                    />
                    {fieldErrors.givenName ? (
                      <p
                        id={`${formId}-given-error`}
                        role="alert"
                        className="text-caption text-destructive"
                      >
                        {fieldErrors.givenName}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {show("familyName") ? (
                  <div className="space-y-1">
                    <label
                      htmlFor={`${formId}-family`}
                      className="text-body text-foreground"
                    >
                      نام خانوادگی
                    </label>
                    <Input
                      id={`${formId}-family`}
                      name="familyName"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.familyName)}
                      aria-describedby={
                        fieldErrors.familyName
                          ? `${formId}-family-error`
                          : undefined
                      }
                      disabled={busy}
                    />
                    {fieldErrors.familyName ? (
                      <p
                        id={`${formId}-family-error`}
                        role="alert"
                        className="text-caption text-destructive"
                      >
                        {fieldErrors.familyName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {show("mobilePhone") ? (
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-mobile`}
                  className="text-body text-foreground"
                >
                  موبایل
                </label>
                <Input
                  id={`${formId}-mobile`}
                  name="mobilePhone"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  dir="ltr"
                  className="text-tabular"
                  inputMode="tel"
                  aria-invalid={Boolean(fieldErrors.mobilePhone)}
                  aria-describedby={
                    fieldErrors.mobilePhone
                      ? `${formId}-mobile-error`
                      : undefined
                  }
                  disabled={busy}
                />
                {fieldErrors.mobilePhone ? (
                  <p
                    id={`${formId}-mobile-error`}
                    role="alert"
                    className="text-caption text-destructive"
                  >
                    {fieldErrors.mobilePhone}
                  </p>
                ) : null}
              </div>
            ) : null}

            {fieldErrors.form ? (
              <StatusMessage kind="error">{fieldErrors.form}</StatusMessage>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={busy}>
                {editingId ? "ذخیره هویت" : "ایجاد پرسنل"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  انصراف
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby={`${formId}-list-heading`}>
        <h2 id={`${formId}-list-heading`} className="text-heading-sm">
          پرسنل ثبت‌شده
        </h2>

        {listQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <StatusMessage kind="loading">
              {operationalCopy.personListLoading}
            </StatusMessage>
            <Skeleton className="h-10 w-full" aria-hidden />
            <Skeleton className="h-10 w-full" aria-hidden />
          </div>
        ) : null}

        {listQuery.isError ? (
          <StatusMessage kind="error">
            {listQuery.error.message || operationalCopy.personListError}
          </StatusMessage>
        ) : null}

        {listQuery.data && listQuery.data.length === 0 ? (
          <StatusMessage kind="empty">
            {operationalCopy.personListEmpty}
          </StatusMessage>
        ) : null}

        {listQuery.data && listQuery.data.length > 0 ? (
          <ul className="divide-y divide-border border border-border">
            {listQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-body text-foreground">
                    {row.givenName ?? ""} {row.familyName ?? ""}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {row.personnelCode ? (
                      <>
                        کد پرسنلی:{" "}
                        <span className="text-tabular" dir="ltr">
                          {toPersianDigits(row.personnelCode)}
                        </span>
                      </>
                    ) : null}
                    {row.personnelCode && row.mobilePhone ? " · " : null}
                    {row.mobilePhone ? (
                      <>
                        موبایل:{" "}
                        <span className="text-tabular" dir="ltr">
                          {toPersianDigits(row.mobilePhone)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    startEdit({
                      id: row.id!,
                      givenName: row.givenName,
                      familyName: row.familyName,
                      mobilePhone: row.mobilePhone,
                    })
                  }
                  disabled={busy}
                >
                  ویرایش هویت
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="space-y-3"
        aria-labelledby={`${formId}-dictionary-heading`}
      >
        <h2 id={`${formId}-dictionary-heading`} className="text-heading-sm">
          {operationalCopy.personDictionaryHeading}
        </h2>
        <p className="text-caption text-muted-foreground">
          {operationalCopy.personDictionaryHint}
        </p>
        {dictionaryQuery.isLoading ? (
          <StatusMessage kind="loading">
            {operationalCopy.personDictionaryLoading}
          </StatusMessage>
        ) : null}
        {dictionaryQuery.isError ? (
          <StatusMessage kind="error">
            {dictionaryQuery.error.message ||
              operationalCopy.personDictionaryError}
          </StatusMessage>
        ) : null}
        {dictionaryQuery.data && dictionaryQuery.data.length > 0 ? (
          <ul className="divide-y divide-border border border-border text-caption">
            {dictionaryQuery.data.map((el) => (
              <li
                key={el.elementId}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
              >
                <span className="text-foreground">{el.labelFa}</span>
                <span className="text-muted-foreground" dir="ltr">
                  {el.disposition}
                  {el.enabled ? " · enabled" : " · disabled"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

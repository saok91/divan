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

/**
 * Thin Person create + list panel (Story 3.1).
 * Not Epic 5 personnel-data-table / search / profile.
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
      setFieldErrors({ form: err.message || operationalCopy.personActionFailed });
    },
  });

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!personnelCode.trim() && !editingId) {
      next.personnelCode = operationalCopy.personPersonnelCodeRequired;
    }
    if (!givenName.trim()) next.givenName = operationalCopy.personGivenNameRequired;
    if (!familyName.trim()) {
      next.familyName = operationalCopy.personFamilyNameRequired;
    }
    if (!mobilePhone.trim()) {
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
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        mobilePhone: mobilePhone.trim(),
      });
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
    givenName: string;
    familyName: string;
    mobilePhone: string;
  }) {
    setEditingId(row.id);
    setGivenName(row.givenName);
    setFamilyName(row.familyName);
    setMobilePhone(row.mobilePhone);
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 text-foreground">
      <header className="space-y-2">
        <h1 className="text-heading">پرسنل</h1>
        <p className="text-body text-muted-foreground">
          ایجاد و نگهداری هویت پایدار پرسنل با کد پرسنلی یکتا.
        </p>
      </header>

      <section
        className="space-y-4"
        aria-labelledby={`${formId}-create-heading`}
      >
        <h2 id={`${formId}-create-heading`} className="text-heading-sm">
          {editingId ? "ویرایش هویت پرسنل" : "ایجاد پرسنل"}
        </h2>

        <form
          className="space-y-4"
          onSubmit={onSubmit}
          noValidate
          aria-busy={busy}
        >
          {!editingId ? (
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

          <div className="grid gap-4 sm:grid-cols-2">
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
                  fieldErrors.givenName ? `${formId}-given-error` : undefined
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
          </div>

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
                    {row.givenName} {row.familyName}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    کد پرسنلی:{" "}
                    <span className="text-tabular" dir="ltr">
                      {toPersianDigits(row.personnelCode)}
                    </span>
                    {" · "}
                    موبایل:{" "}
                    <span className="text-tabular" dir="ltr">
                      {toPersianDigits(row.mobilePhone)}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => startEdit(row)}
                  disabled={busy}
                >
                  ویرایش هویت
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

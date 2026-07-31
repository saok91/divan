# Story 8.1 — Interaction Audit & Gap List

**Date:** 2026-07-31
**Story:** `8-1-interaction-system-audit-control-contract`
**Scope:** Presentation / interaction only (UX-DR30, FR-58). Domain semantics unchanged.

## Semantic → appearance contract (encoded in `button.tsx`)

| Semantics | Variant | Notes |
| --- | --- | --- |
| Primary CTA | `primary` | Gold; one per surface region |
| Secondary / draft / parallel | `secondary` | Blue |
| Default toolbar / non-primary | `tertiary` | Surface + `--control-border` |
| Row action | `rowAction` | Outlined at rest; size `xs` (~24px) |
| Destructive | `destructive` | Confirm via existing dialogs |
| Dialog cancel / inline dismiss | `ghost` | **Only** allowed ghost contexts |
| Text link | `link` | Not row/toolbar substitute |
| Deprecated alias of tertiary | `outline` | Same classes as `tertiary` (compat) |

**Choice documented:** `outline` kept as deprecated alias of `tertiary` for one story; call sites migrated to `tertiary` / `ghost` / `rowAction` as appropriate. Prefer `tertiary` for new code.

**jalali-date-picker month nav:** kept as **`ghost`** (inline dismiss/chrome) — documented survivor.

**Review patches (2026-07-31):** `disabledReason` wrapper + `aria-describedby`; import surface-toolbar cancel → `tertiary`; sheet-open demotes page-toolbar `primary`; row actions normalized to `xs`; selfcheck tightened for toolbar ghost + `buttonVariants({ variant: "ghost" })`.

---

## Full control inventory (apps/web `Button` call sites)

Every `<Button` in `apps/web/components` + `apps/web/app` after Story 8.1 review patches. Count: **170**.

| File | Line | Label / role | Variant | Size | Placement | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `components/access/access-people-panel.tsx` | 305 | openRolesDialog(row)} > تخصیص نقش | `rowAction` | `xs` | row | — |
| `components/access/access-people-panel.tsx` | 313 | openScopesDialog(row)} > محدوده | `rowAction` | `xs` | row | — |
| `components/access/access-people-panel.tsx` | 321 | فعال‌سازی | `rowAction` | `xs` | surface | — |
| `components/access/access-people-panel.tsx` | 385 | ذخیره پیوند | `secondary` | `default` | surface | — |
| `components/access/access-people-panel.tsx` | 392 | setLinkValue(""), }, ); }} > حذف پیوند | `tertiary` | `default` | surface | — |
| `components/access/access-people-panel.tsx` | 415 | فعال‌سازی | `secondary` | `default` | toolbar | — |
| `components/access/access-people-panel.tsx` | 429 | غیرفعال‌سازی | `tertiary` | `default` | surface | — |
| `components/access/access-people-panel.tsx` | 592 | setAssignKind(null); setDraftRoleIds([]); setDraftScopeIds([]); setAssignBaselin | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/access/access-people-panel.tsx` | 604 | (children) | `(default primary)` | `default` | dialog-footer | — |
| `components/access/access-roles-panel.tsx` | 157 | افزودن مجموعه | `secondary` | `default` | surface | — |
| `components/access/access-roles-panel.tsx` | 254 | درخواست ایجاد نقش | `secondary` | `default` | surface | — |
| `components/access/access-scopes-panel.tsx` | 86 | scope.active ? "غیرفعال‌سازی" : "فعال‌سازی" | `tertiary` | `sm` | surface | — |
| `components/access/access-scopes-panel.tsx` | 130 | درخواست ایجاد محدوده | `secondary` | `default` | surface | — |
| `components/access/break-glass-panel.tsx` | 250 | ثبت درخواست اضطراری | `(default primary)` | `default` | surface | — |
| `components/access/break-glass-panel.tsx` | 289 | تأیید | `secondary` | `default` | toolbar | — |
| `components/access/break-glass-panel.tsx` | 304 | فعال‌سازی | `secondary` | `default` | surface | — |
| `components/access/break-glass-panel.tsx` | 319 | رد | `secondary` | `default` | surface | — |
| `components/access/break-glass-panel.tsx` | 338 | لغو | `secondary` | `default` | surface | — |
| `components/access/break-glass-panel.tsx` | 381 | operationalCopy.breakGlassReviewAction | `(default primary)` | `default` | surface | — |
| `components/access/entitlement-grants-panel.tsx` | 299 | تأیید | `secondary` | `default` | toolbar | — |
| `components/access/entitlement-grants-panel.tsx` | 316 | فعال‌سازی | `secondary` | `default` | surface | — |
| `components/access/entitlement-grants-panel.tsx` | 333 | رد | `tertiary` | `default` | surface | — |
| `components/access/entitlement-grants-panel.tsx` | 350 | لغو | `tertiary` | `default` | surface | — |
| `components/access/entitlement-grants-panel.tsx` | 367 | بازتأیید | `rowAction` | `default` | surface | — |
| `components/access/entitlement-grants-panel.tsx` | 531 | ثبت درخواست | `(default primary)` | `default` | surface | — |
| `components/audit/audit-investigation-panel.tsx` | 542 | operationalCopy.auditApplyFilters | `primary` | `default` | surface | — |
| `components/audit/audit-investigation-panel.tsx` | 545 | operationalCopy.clearFilters | `secondary` | `default` | surface | — |
| `components/audit/audit-investigation-panel.tsx` | 561 | setDetail(row); setArtifactError(null); setCustodyAck(false); setRecipient("");  | `rowAction` | `xs` | row | — |
| `components/audit/audit-investigation-panel.tsx` | 692 | operationalCopy.auditOpenExportArtifact | `primary` | `sm` | surface | — |
| `components/audit/audit-investigation-panel.tsx` | 708 | operationalCopy.auditOpenReview | `secondary` | `sm` | surface | — |
| `components/audit/audit-investigation-panel.tsx` | 726 | setDetail(null)} > بستن | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/authz-changed-modal.tsx` | 116 | operationalCopy.authzChangedSaveDraft | `secondary` | `default` | dialog-footer | — |
| `components/authz-changed-modal.tsx` | 126 | operationalCopy.authzChangedDiscard | `tertiary` | `default` | dialog-footer | — |
| `components/authz-changed-modal.tsx` | 138 | operationalCopy.authzChangedAcknowledge | `primary` | `default` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 459 | breachedOnly ? operationalCopy.correctionCaseFilterAll : operationalCopy.correct | `{breachedOnly ? "primary" : "outline"}` | `sm` | surface | outline alias / conditional |
| `components/correction-cases/correction-cases-panel.tsx` | 470 | operationalCopy.correctionCaseOpen | `(default primary)` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 505 | operationalCopy.correctionCaseDetail | `rowAction` | `xs` | row | — |
| `components/correction-cases/correction-cases-panel.tsx` | 589 | operationalCopy.correctionCaseStatusInProgress | `tertiary` | `sm` | toolbar | — |
| `components/correction-cases/correction-cases-panel.tsx` | 607 | operationalCopy.correctionCaseStatusPendingDecision | `tertiary` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 626 | operationalCopy.correctionCaseDecide | `(default primary)` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 639 | operationalCopy.correctionCaseClose | `(default primary)` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 652 | operationalCopy.correctionCaseLinkOutcome | `tertiary` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 663 | operationalCopy.correctionCaseAddEvidence | `tertiary` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 694 | operationalCopy.correctionCaseDownload | `rowAction` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 704 | operationalCopy.correctionCasePreview | `rowAction` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 728 | operationalCopy.correctionCaseUpload | `(default primary)` | `sm` | surface | — |
| `components/correction-cases/correction-cases-panel.tsx` | 836 | operationalCopy.correctionCaseCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/correction-cases/correction-cases-panel.tsx` | 843 | operationalCopy.correctionCaseConfirm | `(default primary)` | `default` | dialog-footer | — |
| `components/correction-cases/correction-cases-panel.tsx` | 910 | operationalCopy.correctionCaseCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/correction-cases/correction-cases-panel.tsx` | 917 | operationalCopy.correctionCaseConfirm | `(default primary)` | `default` | dialog-footer | — |
| `components/correction-cases/correction-cases-panel.tsx` | 950 | operationalCopy.correctionCaseCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/correction-cases/correction-cases-panel.tsx` | 957 | operationalCopy.correctionCaseConfirm | `(default primary)` | `default` | dialog-footer | — |
| `components/correction-cases/correction-cases-panel.tsx` | 1031 | operationalCopy.correctionCaseCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/correction-cases/correction-cases-panel.tsx` | 1038 | operationalCopy.correctionCaseConfirm | `(default primary)` | `default` | dialog-footer | — |
| `components/correction-cases/correction-cases-panel.tsx` | 1098 | operationalCopy.correctionCaseCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/correction-cases/correction-cases-panel.tsx` | 1105 | operationalCopy.correctionCaseConfirm | `(default primary)` | `default` | dialog-footer | — |
| `components/export/export-artifact-panel.tsx` | 208 | operationalCopy.exportOpenPanel | `secondary` | `sm` | surface | — |
| `components/export/export-artifact-panel.tsx` | 256 | busy ? operationalCopy.exportBusy : operationalCopy.exportGenerate | `primary` | `default` | surface | — |
| `components/export/export-artifact-panel.tsx` | 380 | operationalCopy.exportDownload | `secondary` | `default` | dialog-footer | — |
| `components/export/export-artifact-panel.tsx` | 396 | operationalCopy.exportClose | `ghost` | `default` | surface | allowed ghost |
| `components/governed-data-table/governed-data-table.tsx` | 83 | label | `tertiary` | `sm` | surface | — |
| `components/governed-data-table/governed-data-table.tsx` | 372 | operationalCopy.clearFilters | `secondary` | `sm` | surface | — |
| `components/governed-data-table/governed-data-table.tsx` | 427 | goToPage(pageIndex - 1)} aria-label="صفحه قبل" > قبلی | `tertiary` | `sm` | pagination | — |
| `components/governed-data-table/governed-data-table.tsx` | 437 | goToPage(pageIndex + 1)} aria-label="صفحه بعد" > بعدی | `tertiary` | `sm` | surface | — |
| `components/headcount/approval-panel.tsx` | 284 | createMutation.isPending ? "در حال ثبت…" : "ایجاد پیش‌نویس" | `(default primary)` | `default` | surface | — |
| `components/headcount/approval-panel.tsx` | 336 | void runAction(row.id, "activate")} > فعال‌سازی | `secondary` | `sm` | toolbar | — |
| `components/headcount/approval-panel.tsx` | 347 | void runAction(row.id, "cancel")} > لغو | `rowAction` | `sm` | surface | — |
| `components/headcount/exemption-panel.tsx` | 244 | ثبت پیش‌نویس معافیت | `(default primary)` | `default` | surface | — |
| `components/headcount/exemption-panel.tsx` | 291 | فعال‌سازی | `secondary` | `sm` | toolbar | — |
| `components/headcount/exemption-panel.tsx` | 305 | لغو | `rowAction` | `sm` | surface | — |
| `components/headcount/override-panel.tsx` | 195 | ابطال | `secondary` | `sm` | surface | — |
| `components/import/import-wizard.tsx` | 360 | uploadMutation.isPending ? operationalCopy.importStepValidate : operationalCopy. | `{previewLoaded ? "tertiary" : "primary"}` | `default` | toolbar | — |
| `components/import/import-wizard.tsx` | 373 | operationalCopy.importReopenPreview | `tertiary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 382 | operationalCopy.importCancelPreview | `tertiary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 393 | operationalCopy.importApproveAction | `{sheetOpen ? "tertiary" : "primary"}` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 404 | operationalCopy.reconTrialExecuteOnly | `{sheetOpen ? "tertiary" : "primary"}` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 417 | operationalCopy.reconProductionExecute | `tertiary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 554 | operationalCopy.importCancelPreview | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/import/import-wizard.tsx` | 562 | operationalCopy.importClosePreview | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/import/import-wizard.tsx` | 571 | operationalCopy.importConfirmDraft | `primary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 590 | operationalCopy.importApproveAction | `primary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 601 | operationalCopy.reconTrialExecuteOnly | `primary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 613 | operationalCopy.reconProductionExecute | `tertiary` | `default` | surface | — |
| `components/import/import-wizard.tsx` | 648 | operationalCopy.importConfirmDismiss | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/import/import-wizard.tsx` | 655 | operationalCopy.importConfirmDraft | `primary` | `default` | dialog-footer | — |
| `components/import/migration-reconciliation-workspace.tsx` | 355 | operationalCopy.reconCreateRun | `tertiary` | `default` | toolbar | — |
| `components/import/migration-reconciliation-workspace.tsx` | 363 | operationalCopy.reconCompare | `tertiary` | `default` | toolbar | — |
| `components/import/migration-reconciliation-workspace.tsx` | 371 | operationalCopy.reconAttestControls | `tertiary` | `default` | toolbar | — |
| `components/import/migration-reconciliation-workspace.tsx` | 553 | operationalCopy.reconDispositionAction | `tertiary` | `sm` | surface | — |
| `components/import/migration-reconciliation-workspace.tsx` | 584 | operationalCopy.reconSignMigrationLead | `tertiary` | `default` | toolbar | — |
| `components/import/migration-reconciliation-workspace.tsx` | 592 | operationalCopy.reconSignHrDataOwner | `tertiary` | `default` | toolbar | — |
| `components/jalali-date-picker.tsx` | 149 | onViewChange(addJalaliMonths(view, 1))} > | `ghost` | `icon` | surface | allowed ghost |
| `components/jalali-date-picker.tsx` | 162 | onViewChange(addJalaliMonths(view, -1))} > | `ghost` | `icon` | surface | allowed ghost |
| `components/jalali-date-picker.tsx` | 379 | announce | `tertiary` | `icon` | surface | — |
| `components/leave-guard/leave-guard-dialog.tsx` | 76 | operationalCopy.leaveGuardStay | `primary` | `default` | dialog-footer | — |
| `components/leave-guard/leave-guard-dialog.tsx` | 87 | operationalCopy.authzChangedDiscard | `tertiary` | `default` | dialog-footer | — |
| `components/leave-guard/leave-guard-dialog.tsx` | 98 | saveLabel | `secondary` | `default` | surface | — |
| `components/login-form.tsx` | 92 | pending ? "در حال ورود…" : "ورود" | `primary` | `default` | surface | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 378 | resetForm(); setModal("create"); }} > افزودن | `(default primary)` | `default` | surface | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 396 | resetForm(); setModal("create"); }} > افزودن | `(default primary)` | `default` | toolbar | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 408 | openEdit(row)} > ویرایش | `rowAction` | `xs` | row | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 417 | openDeactivate(row)} > غیرفعال‌سازی | `rowAction` | `xs` | row | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 427 | فعال‌سازی | `rowAction` | `xs` | surface | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 500 | resetForm(); setModal(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-flat-job-ref-panel.tsx` | 510 | ایجاد | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 562 | resetForm(); setModal(null); setEditTarget(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-flat-job-ref-panel.tsx` | 573 | ذخیره | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-flat-job-ref-panel.tsx` | 612 | resetForm(); setModal(null); setEditTarget(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-flat-job-ref-panel.tsx` | 623 | تأیید غیرفعال‌سازی | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-hierarchy-panel.tsx` | 392 | openCreate(null)}> افزودن | `(default primary)` | `default` | surface | — |
| `components/organization/org-hierarchy-panel.tsx` | 423 | openCreate(selectedNode)} > افزودن | `(default primary)` | `default` | toolbar | — |
| `components/organization/org-hierarchy-panel.tsx` | 439 | openDeactivate(node)} > غیرفعال‌سازی | `rowAction` | `xs` | row | — |
| `components/organization/org-hierarchy-panel.tsx` | 449 | فعال‌سازی | `rowAction` | `xs` | row | — |
| `components/organization/org-hierarchy-panel.tsx` | 459 | openEdit(node)} > ویرایش | `rowAction` | `xs` | surface | — |
| `components/organization/org-hierarchy-panel.tsx` | 487 | فعال‌سازی | `rowAction` | `xs` | surface | — |
| `components/organization/org-hierarchy-panel.tsx` | 610 | resetForm(); setModal(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-hierarchy-panel.tsx` | 620 | createMutation.isPending ? "در حال ثبت…" : "ایجاد" | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-hierarchy-panel.tsx` | 703 | resetForm(); setModal(null); setEditTargetId(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-hierarchy-panel.tsx` | 714 | ذخیره | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-hierarchy-panel.tsx` | 774 | resetForm(); setModal(null); setEditTargetId(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-hierarchy-panel.tsx` | 785 | تأیید غیرفعال‌سازی | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-ladder-grade-panel.tsx` | 473 | resetForm(); setModal("create-ladder"); }} > افزودن نردبان | `(default primary)` | `default` | surface | — |
| `components/organization/org-ladder-grade-panel.tsx` | 535 | resetForm(); setModal("create-ladder"); }} > افزودن نردبان | `(default primary)` | `default` | toolbar | — |
| `components/organization/org-ladder-grade-panel.tsx` | 544 | resetForm(); setModal("create-grade"); }} > افزودن گرید | `secondary` | `default` | toolbar | — |
| `components/organization/org-ladder-grade-panel.tsx` | 560 | void openDeactivate(node)} > غیرفعال‌سازی | `rowAction` | `xs` | row | — |
| `components/organization/org-ladder-grade-panel.tsx` | 570 | فعال‌سازی | `rowAction` | `xs` | row | — |
| `components/organization/org-ladder-grade-panel.tsx` | 586 | openEdit(node)} > ویرایش | `rowAction` | `xs` | surface | — |
| `components/organization/org-ladder-grade-panel.tsx` | 652 | resetForm(); setModal(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-ladder-grade-panel.tsx` | 662 | ایجاد | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-ladder-grade-panel.tsx` | 743 | resetForm(); setModal(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-ladder-grade-panel.tsx` | 753 | ایجاد | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-ladder-grade-panel.tsx` | 820 | resetForm(); setModal(null); setEditTargetId(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-ladder-grade-panel.tsx` | 831 | ذخیره | `(default primary)` | `default` | dialog-footer | — |
| `components/organization/org-ladder-grade-panel.tsx` | 887 | resetForm(); setModal(null); setEditTargetId(null); }} > انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/organization/org-ladder-grade-panel.tsx` | 898 | تأیید غیرفعال‌سازی | `(default primary)` | `default` | dialog-footer | — |
| `components/personnel/personnel-add-panel.tsx` | 257 | busy ? "در حال ایجاد…" : "ایجاد پرسنل" | `primary` | `default` | surface | — |
| `components/personnel/personnel-event-form.tsx` | 1610 | const cleared = emptySnapshot(); applySnapshot(cleared); lastSavedRef.current =  | `ghost` | `default` | form-footer | allowed ghost |
| `components/personnel/personnel-event-form.tsx` | 1626 | ذخیره پیش‌نویس | `secondary` | `default` | surface | — |
| `components/personnel/personnel-event-form.tsx` | 1634 | void onDelete()} > حذف پیش‌نویس | `destructive` | `default` | surface | — |
| `components/personnel/personnel-event-form.tsx` | 1643 | setConfirmOpen(true); }} > نهایی‌سازی | `primary` | `default` | surface | — |
| `components/personnel/personnel-event-form.tsx` | 1717 | openLifecycle("cancel", row.event.id)} > لغو | `rowAction` | `sm` | toolbar | — |
| `components/personnel/personnel-event-form.tsx` | 1728 | openLifecycle("reverse", row.event.id)} > بازگشت | `rowAction` | `sm` | surface | — |
| `components/personnel/personnel-event-form.tsx` | 1739 | openLifecycle("correct", row.event.id)} > اصلاح | `rowAction` | `sm` | surface | — |
| `components/personnel/personnel-event-lifecycle-controls.tsx` | 109 | openLifecycle("cancel")} > لغو | `tertiary` | `sm` | toolbar | — |
| `components/personnel/personnel-event-lifecycle-controls.tsx` | 120 | openLifecycle("reverse")} > بازگشت | `tertiary` | `sm` | toolbar | — |
| `components/personnel/personnel-event-lifecycle-controls.tsx` | 131 | openLifecycle("correct")} > اصلاح | `tertiary` | `sm` | surface | — |
| `components/personnel/personnel-event-timeline.tsx` | 154 | timelineQuery.isFetching ? "در حال بارگذاری…" : TIMELINE_LOAD_MORE_LABEL_FA | `tertiary` | `sm` | surface | — |
| `components/personnel/personnel-events-list-panel.tsx` | 131 | ثبت رویداد | `primary` | `default` | toolbar | — |
| `components/personnel/personnel-lifecycle-panel.tsx` | 240 | operationalCopy.lifecyclePlaceHold | `(default primary)` | `default` | toolbar | — |
| `components/personnel/personnel-lifecycle-panel.tsx` | 247 | operationalCopy.lifecycleRunDisposal | `tertiary` | `default` | toolbar | — |
| `components/personnel/personnel-lifecycle-panel.tsx` | 284 | operationalCopy.lifecycleReleaseHold | `tertiary` | `sm` | surface | — |
| `components/personnel/personnel-lifecycle-panel.tsx` | 362 | operationalCopy.lifecycleCancel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/personnel/personnel-lifecycle-panel.tsx` | 372 | (children) | `{confirm === "dispose" ? "outline" : "primary"}` | `default` | dialog-footer | outline alias / conditional |
| `components/personnel/personnel-list-panel.tsx` | 314 | افزودن سریع | `primary` | `default` | toolbar | — |
| `components/personnel/personnel-list-panel.tsx` | 342 | openEdit(row)} > اطلاعات کامل/ویرایش | `rowAction` | `xs` | row | — |
| `components/personnel/personnel-list-panel.tsx` | 350 | navigateRegister(row.id)} > ثبت رویداد | `rowAction` | `xs` | row | — |
| `components/personnel/personnel-list-panel.tsx` | 368 | goToServerPage(page - 1)} > صفحه قبل | `tertiary` | `sm` | pagination | disabledReason |
| `components/personnel/personnel-list-panel.tsx` | 389 | goToServerPage(page + 1)} > صفحه بعد | `tertiary` | `sm` | surface | — |
| `components/personnel/personnel-quick-create-dialog.tsx` | 346 | busy ? "در حال ایجاد…" : "ایجاد" | `primary` | `default` | dialog-footer | — |
| `components/personnel/personnel-quick-create-dialog.tsx` | 349 | انصراف | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/personnel/personnel-quick-edit-modal.tsx` | 357 | busy ? "در حال ذخیره…" : "ذخیره" | `primary` | `default` | dialog-footer | — |
| `components/personnel/personnel-quick-edit-modal.tsx` | 360 | انصراف | `ghost` | `default` | toolbar | allowed ghost |
| `components/personnel/sensitive-confirmation-dialog.tsx` | 115 | cancelLabel | `ghost` | `default` | dialog-footer | allowed ghost |
| `components/personnel/sensitive-confirmation-dialog.tsx` | 123 | confirmLabel | `primary` | `default` | dialog-footer | — |
| `components/reports/decision-publication-panel.tsx` | 140 | operationalCopy.publicationPublishCta | `secondary` | `sm` | form-footer | — |
| `components/reports/decision-publication-panel.tsx` | 304 | operationalCopy.publicationConfirmCancel | `ghost` | `sm` | surface | allowed ghost |
| `components/reports/decision-publication-panel.tsx` | 313 | operationalCopy.publicationConfirmProceed | `primary` | `sm` | surface | — |
| `components/reports/report-catalogue-panel.tsx` | 291 | runQuery.data.reconcileLabelFa ?? "مشاهده مرتبط" | `tertiary` | `sm` | toolbar | — |
| `components/reports/report-catalogue-panel.tsx` | 326 | openHref(row.href!)} > مشاهده | `rowAction` | `xs` | row | — |
| `components/ui/dialog.tsx` | 114 | بستن | `ghost` | `default` | dialog-footer | allowed ghost |

## Allowed `ghost` survivors (explicit)

1. `sensitive-confirmation-dialog.tsx` — Cancel  
2. `personnel-quick-create-dialog.tsx` — انصراف  
3. `personnel-quick-edit-modal.tsx` — انصراف  
4. `personnel-event-form.tsx` — انصراف  
5. `components/ui/dialog.tsx` — بستن  
6. Org/access/correction/lifecycle/import dialog·sheet cancels / dismiss (`انصراف`, `بستن`, import cancel/close/confirm-dismiss, correction cancel, lifecycle cancel, publication confirm cancel, export close, audit detail بستن)  
7. `jalali-date-picker.tsx` — month prev/next (inline chrome)

## Retired `ghost` contexts (must fail selfcheck)

- Any `variant="ghost"` inside `rowActions` / `renderRowEnd`  
- Pagination chrome (`aria-label` صفحه‌بندی…)  
- Leave-guard Discard (must remain `tertiary`)  
- Surface toolbars that are not dialog cancel/dismiss  

Guard: `pnpm --filter @divan/web selfcheck:control-contract`

---

## Fixed in 8.1 vs deferred to 8.2–8.9

### Fixed here

- Published UX-DR30 mapping next to `Button` (JSDoc)  
- New variants: `tertiary`, `rowAction`, `destructive`; optional `disabledReason`  
- Minimal tokens: `--control-border`, `--disabled-surface`, `--disabled-foreground`, `--hairline`  
- Row/toolbar/pagination ghost retirement on inventoried surfaces  
- Dialog cancel migration outline → ghost  
- org-flat row-action consistency + padding (`size="xs"`)  
- Dual-gold mitigation on import upload vs post-preview CTAs; page toolbar `primary` demotes while preview sheet is open  
- Import surface-toolbar cancel-preview → `tertiary` (sheet/dialog dismiss remain `ghost`)  
- Row-action size/padding normalized to `xs` (personnel-list, access-people, report-catalogue, org-hierarchy)  
- `disabledReason` discoverable via wrapper `title` + `aria-describedby` helper  
- Leave-guard Discard → tertiary (Stay sole gold)  
- Control-contract selfcheck + npm script  

### Deferred — Story **8.2**

- Full spacing grid / page-header / section-tabs 30px / form-layout system  
- Complete neutral scale migration in `globals.css`  
- Component gallery  

### Deferred — Stories **8.3–8.5**

- `entity-picker` + code resolvers / UUID ergonomics  

### Deferred — Story **8.6**

- GovernedDataTable readability / min-width removal / dense table chrome  

### Deferred — Story **8.7**

- Full per-action **icon** mapping for row actions  
- Leave-guard silent early-return / dead-click elimination  
- Overflow menu beyond two row actions  
- Inert-action selfcheck across all surfaces  

### Deferred — Story **8.8**

- Skeleton / toast / feedback precedence system  

### Deferred — Story **8.9**

- Recalc-banner rewrite / glossary  
- Full operational-copy overhaul  
- Remaining `disabled` Buttons **without** `disabledReason` (only pagination + touched sites migrated in 8.1)  

### Deferred — Story **8.10**

- Mockup QA / consistency / a11y gate — do **not** claim FR-58 / LG-6 production-complete from 8.1 alone  

---

## Remaining `disabled`-without-reason sites (sample → 8.9)

Non-exhaustive; migrate opportunistically later:

- Most form submit buttons while `busy` / mutation pending  
- Import wizard / recon / correction / headcount busy disables  
- GovernedDataTable pagination prev/next  
- Access assign / link / grant pending states  
- Org create/edit submit disables  

8.1 added reasons on personnel-list server pagination as the exemplar for touched chrome.

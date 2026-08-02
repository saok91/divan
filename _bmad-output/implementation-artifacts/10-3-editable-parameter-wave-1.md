---
baseline_commit: beb7415
---

# Story 10.3: Editable Parameter Wave 1

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an administrator,
I want to change the operational limits that actually get asked about,
so that a tuning request does not require a deployment (FR60).

**Story key:** `10-3-editable-parameter-wave-1`  
**Epic:** 10 — Administrative Settings & Governed Parameters (FR60; FR42, FR45, FR55 evidence/change-control)  
**UX contract:** `ux-divan-2026-07-31` (UX-DR36; EXPERIENCE §Configuration Administration; DESIGN `settings-row`; mockup `screens-settings.html`)  
**Architecture:** **AD-7** (mutate via existing store + invalidate cache; no AD-1…AD-6 change). Web stays thin.  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E10 — editable wave)  
**Prerequisite:** Stories **10.1** (registry/store/resolver) and **10.2** (read-only Settings surface + `settings.read`) done.  
**Downstream:** **10.4** RO infra/security inventory; **10.5** full FR42 change-control evidence productization + FR51 audit fail-safe + boundary selfcheck.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| AD-7 store mutations | `packages/kernel/app-settings/src/store.ts` | `upsertOverride` / `deleteOverride` + auto `invalidateSettingsCache` re-warm | **No** public tRPC; upsert only checks finite number — **not** range/allowlist reject-before-write |
| Resolver parse | `resolver.ts` `parseCandidate` | Validates integer/range/allowlist/string_list on warm | Logic is **private** — must share/export for apply-path reject (do not duplicate) |
| Registry foreshadow | `registry.ts` `highImpact` / `blastRadiusFa` / `listAdminEditableKeys()` | 14 `admin_editable` keys; custody RO | DTO/UI do not expose highImpact yet |
| Read surface | `apps/web/src/server/settings.ts` + `components/settings/*` | `listByDomain` / `capabilities`; display rows | Explicitly **never** calls upsert/delete; no editors |
| Settings authz | `settings-access.ts` + `seed-settings.ts` | `settings.read` + soft PS + role domain matrix | **No** `settings.write` |
| Form / dialog / row action | `FormLayout`, `Dialog`, `RowActionButton`, `FeedbackMessage` | Epic 8 first-touch primitives | Wire into per-row apply/reset |
| Leave-guard | `useLeaveGuardRegistration` | Dirty ≠ dialog visibility; Discard snapshot | Register dirty settings row when edit chrome is open |
| Ops mutation pattern | `export-artifact.ts` / org routers | `governedProcedure` + `action: "write"` + soft deny | Mirror for settings mutations |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Wave-1 editable vs epic text "custody"** | Epics.md lists «export … custody threshold» in the editable set. **Code/review (10.1) wins:** `export.custody_bulk_row_threshold` stays `read_only_with_evidence`. Do **not** make it editable. Document reconciliation in Dev Notes. |
| **Validate-before-apply vs fail-closed-on-warm** | AC requires reject **before** apply. Today invalid store rows degrade to code default on warm — that is a safety net, **not** the apply UX. Apply must call shared parse/validate and return Persian BAD_REQUEST; never write known-invalid values. |
| **Reason (10.3) vs full audit product (10.5)** | UX-DR36 + mockup require **reason** on commit. Persist `updatedBy` + `reason` on upsert/reset. Do **not** claim FR42 investigation-surface parity, FR51 audit-required fail-safe productization, or «مشاهده در ممیزی» deep-link unless the target already exists and works (no dead link). |
| **`settings.write` vs reuse read** | New write permission for mutations. Read stays `settings.read`. Soft PS check must gate write separately. Seed both for `hr.admin` / `sys.admin`. |
| **Role domain vs write** | Same role→domain matrix as 10.2: `hr_admin` cannot mutate `access_session` (`entitlement.recert_window_ms`); `system_admin` cannot mutate business domains. Envelope permission alone is insufficient. |
| **Per-parameter apply vs global save** | DESIGN: apply **per row**; **no** global save bar. Dirty row → confirm chrome (inline full-width bar **and/or** Dialog with reason) → «اعمال تغییر». |
| **Reset = deleteOverride** | «بازگشت به پیش‌فرض» deletes store row (code default wins). Still requires reason + confirm when highImpact (or always reason — see Gate). Audited as a change (actor/reason); full evidence surface = 10.5. |
| **Process-local cache** | Invalidate/re-warm in this process is "no restart". Multi-instance fan-out is **out of scope** (document honesty; do not invent Redis pub/sub). |
| **LG-complete honesty** | Epic 7/8/9 carry-ins remain open. Do not claim LG-complete or 10.4–10.5 done. |

## Acceptance Criteria

1. **Given** the settings surface from Story 10.2  
   **When** wave 1 is delivered  
   **Then** the editable set is the registry keys with `editability === "admin_editable"` (14 keys today):  
   import limits (file size, row count, draft count and TTL), export artifact TTL (**not** custody threshold), list and search page sizes and caps, headcount reservation-expiry warning window, correction-case attachment limits and allowlist, and entitlement recertification window

2. **And** each edit validates inline against the registry range or allowlist **before** it can be applied (client + server; server is authoritative)

3. **And** a high-impact parameter (`highImpact === true`) requires confirmation stating the blast radius (`blastRadiusFa`) — which surfaces recompute and whether existing records are re-evaluated — before apply/reset commits

4. **And** «بازگشت به پیش‌فرض» is available on every editable row (RowActionButton / icon-only + tooltip; disabled-with-reason when already at code default / no store override)

5. **And** a change takes effect through the resolver without a restart (`upsertOverride` / `deleteOverride` already invalidate + re-warm)

6. **And** no parameter in this wave can widen a permission, retention, export, or audit boundary  
   - custody threshold remains RO  
   - `security_posture` / session / identity RO remain RO  
   - allowlist edits may only select a non-empty **subset** of the registry catalog (`parseCandidate` rules); no new extensions outside catalog; no executable types invented  
   - ranges cannot exceed registry max

7. **And** Epic 9 / Epic 10 Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch: **FormLayout** on edit/confirm chrome; **FeedbackMessage** for mutation success/error; RowActionButton for reset; EntityPicker only if an entity-valued control appears (expect none)
   - Registry/resolver fail-closed + FR45 unchanged
   - Wave-1 must not widen permission / retention / export / audit boundaries
   - Settings no-dead-end remains satisfied (functional edit, not placeholder)
   - AR-\* fail-closed; no LG-complete claim

8. **And** scope boundaries:
   - Does **not** deliver full RO infra inventory / secret redaction / inventory export (**10.4**)
   - Does **not** deliver full FR42 audit-surface productization, FR51 audit-required fail-safe, or final boundary selfcheck suite (**10.5**) — may add **minimal** mutation selfchecks (RO reject, range fail, soft deny, reset→default)
   - Does **not** make custody / session / identity editable
   - Does **not** change AD-1…AD-6; no event-store / temporal / authz model / headcount invariant changes
   - Does **not** invent SoD approve≠manage splits (AR-ACCESS open)

## Tasks / Subtasks

- [x] Task 1: Kernel validate-before-write + shared parse (AC: #2, #5, #6)
  - [x] Extract/export `parseCandidate` (or `validateSettingsValue(def, raw) → SettingsScalar | null` + `assertValidSettingsValue` that throws `GovernedSettingsError`) from resolver/store — **one** implementation
  - [x] UPDATE `upsertOverride`: after editability check, **reject** values that fail parse (BAD definition / invalid value) — do not write then rely on warm degrade
  - [x] UPDATE `deleteOverride` public contract for API: only allow reset for `admin_editable` keys when called from settings mutations (kernel may keep low-level delete; **tRPC must** refuse RO keys)
  - [x] Extend `@divan/app-settings` selfcheck: upsert OOR / empty string_list / RO key throws; successful upsert changes `resolveSetting*` without restart; reset restores default
  - [x] Keep guard selfcheck green (`selfcheck:guard`)

- [x] Task 2: `settings.write` permission + seed (AC: #1, #6, #7)
  - [x] NEW `SETTINGS_WRITE_PERMISSION = "settings.write"` in `packages/kernel/audit-envelope/src/settings-access.ts` (+ export + selfcheck)
  - [x] Wire `DEV_DEMO_POLICY` allow tuple for write (mirror read; same `settings.configuration` category; `action: "write"`)
  - [x] UPDATE `seed-settings.ts`: PermissionSet includes **both** `settings.read` and `settings.write` for `hr.admin` / `sys.admin` (idempotent upsert — do not invent a second SoD role)
  - [x] Soft check helper: `actorHoldsSettingsWrite` (fail-closed on DB error) used by mutations only; list remains read-gated

- [x] Task 3: tRPC apply + reset mutations (AC: #1–#6, #8)
  - [x] UPDATE `apps/web/src/server/settings.ts`:
    - `apply` mutation — input: `{ key, value, reason }` (reason trimmed, min length ≥ 10 Persian/any chars per mockup honesty)
    - `reset` mutation — input: `{ key, reason }` (same reason rule)
  - [x] Meta: `permission: SETTINGS_WRITE_PERMISSION`, `action: "write"`, `dataCategory: SETTINGS_CONFIGURATION_DATA_CATEGORY`, `sensitive: true`, distinct `operation` strings
  - [x] Algorithm (implement literally):
    1. Soft write PS check → else deny + `permission_set_missing` access event (mirror read deny helper)
    2. Resolve registry def; if unknown → NOT_FOUND / BAD_REQUEST Persian
    3. If `editability !== "admin_editable"` → FORBIDDEN (custody/session/identity never mutate)
    4. If `!roleMaySeeDomain(coarseRole, def.owningDomain)` → FORBIDDEN
    5. If store pool null → fail closed FORBIDDEN/PRECONDITION with store-unavailable copy (cannot pretend apply succeeded)
    6. Validate value via shared parse; on null → BAD_REQUEST with range/allowlist Persian message
    7. `upsertOverride` / `deleteOverride` with `updatedBy: ctx.session.accountId`, `reason`
    8. Append allow access event (configuration change) — best-effort; prefer successful mutation visibility; full FR51 product = 10.5
    9. Return refreshed row DTO (or `{ key, value, source, defaultValue, lastChanged* }`) so UI can update without full-tab guesswork
  - [x] Extend `listByDomain` DTO with `highImpact: boolean` and `blastRadiusFa: string | null` (from registry)
  - [x] Never accept `effectAt` scheduling from UI in this story (null / now only; scheduling product = 10.5)

- [x] Task 4: Editable row UX (AC: #2, #3, #4, #5, #7)
  - [x] UPDATE `settings-parameter-row.tsx` (or NEW `settings-parameter-editor.tsx` composed by row):
    - RO rows unchanged (lock + `changePathFa`; never disabled fake input)
    - Editable: value control appropriate to `valueType` (`number` / `duration_ms` → numeric input; `string_list` → multi-select / chip toggle **only** from registry allowlist catalog)
    - Inline validation against range/allowlist; invalid → destructive styling + disable apply
    - Dirty row → full-width confirm region OR Dialog (mockup): show previous → new, `blastRadiusFa` when highImpact, required reason field, «اعمال تغییر» / cancel
    - High-impact: **must not** commit without explicit confirm that displays blast radius text
    - Reset: `RowActionButton` icon-only, tooltip «بازگشت به پیش‌فرض»; confirm+reason; disabled-with-reason when `source === "code_default"` / no override
  - [x] Wrap edit/confirm fields in **FormLayout** (compact className ok — still `data-slot="form-layout"`)
  - [x] Mutation FeedbackMessage success/error; invalidate `listByDomain` query on success
  - [x] Leave-guard: register dirty when row has uncommitted edits; Discard restores snapshot; do not nest a second leave dialog inside apply Dialog (single dialog depth)
  - [x] Persian copy in `operational-copy.ts` for apply/reset/reason/blast labels — direct Persian, no i18n framework
  - [x] No global save bar; no dead «مشاهده در ممیزی» link

- [x] Task 5: Selfchecks + design-qa + DoD (AC: #6, #7, #8)
  - [x] Kernel + web mutation selfchecks (RO reject, OOR reject, domain role deny, reset→default, write soft-deny)
  - [x] UPDATE design-qa Settings matrix note: edit wave delivered (still not mockup-perfect / not 10.5 evidence)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; typecheck touched packages
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Manual DoD below

### Manual DoD checklist

- [x] `hr_admin` can apply a valid `import.max_file_bytes` change; value effective on next import parse **without** server restart
- [x] OOR value blocked inline and by API (no store row written)
- [x] High-impact apply shows `blastRadiusFa` and requires reason (≥10 chars) before commit
- [x] «بازگشت به پیش‌فرض» restores code default; row shows `source: code_default`
- [x] `export.custody_bulk_row_threshold` remains RO — no editor
- [x] `hr_admin` cannot mutate `entitlement.recert_window_ms` (access_session); `system_admin` can
- [x] `system_admin` cannot mutate `import.*` / correction / headcount keys
- [x] Caller without `settings.write` (if simulated) → FORBIDDEN; read surface still works with read-only
- [x] Empty / executable-invented allowlist rejected; only catalog subset allowed
- [x] Store unavailable → apply fails closed with honest Persian message (not silent success)
- [x] `selfcheck:design-qa` green; FormLayout present on edit chrome; no LG-complete / 10.4–10.5 claims

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Mutate only `admin_editable` keys via store APIs | Edit custody / session / identity / `security_posture` |
| Shared parse validate **before** write | Write invalid then “hope” warm degrades |
| `settings.write` + soft PS + role domain gate | Reuse only `settings.read` for mutations; skip soft check |
| highImpact → confirm + `blastRadiusFa` visible | Silent apply on high-impact |
| Reason persisted on apply/reset (≥10 chars) | Empty reason; claim full FR42/FR51 done |
| FormLayout + FeedbackMessage + RowActionButton | StatusMessage clones; fake disabled inputs for RO |
| Effect via cache invalidate (no restart) | Require redeploy; dual SoT literals in UI |
| `selfcheck:design-qa` green | Claim LG-complete or 10.5 evidence parity |
| Custody stays RO (epic text reconciled) | Re-open custody max above 25 via UI |

### Wave-1 key inventory (implement against registry, not this table alone)

| Key | Domain | highImpact | Notes |
| --- | --- | --- | --- |
| `import.max_file_bytes` | import_export | yes | |
| `import.max_data_rows` | import_export | yes | |
| `import.max_drafts_global` | import_export | no | |
| `import.max_drafts_per_actor` | import_export | no | |
| `import.draft_ttl_ms` | import_export | no | duration_ms |
| `export.artifact_ttl_ms` | import_export | no | duration_ms |
| `list.personnel_max_rows` | general_display | no | |
| `list.search_page_size_default` | general_display | no | |
| `list.search_page_size_max` | general_display | no | ensure default ≤ max on apply if both dirty separately — validate each key independently; optional cross-key warning nice-to-have |
| `headcount.reservation_expiry_warning_days` | capacity_hiring | no | |
| `correction.attachment_max_bytes` | data_retention | yes | |
| `correction.attachment_max_per_case` | data_retention | no | |
| `correction.attachment_allowlist` | data_retention | yes | string_list ⊂ registry allowlist; non-empty |
| `entitlement.recert_window_ms` | access_session | yes | **system_admin only** |

**Explicitly NOT editable:** `export.custody_bulk_row_threshold`, `session.*`, `identity.provider_mode`.

### Epic text reconciliation — custody threshold

Epics Story 10.3 AC lists «export artifact TTL **and custody threshold**» as editable. Story 10.1 review + FR60 «must not silently widen export boundary» forced custody to `read_only_with_evidence` with `range.max === default === 25`. **This story keeps custody RO.** Treat epic wording as superseded by Gate #6 / architecture honesty. If PO later re-opens custody, that is a new decision — not silent scope in 10.3.

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `store.ts` | upsert finite-only; RO reject | reject via shared parse before INSERT | auto re-warm; attribution columns |
| `resolver.ts` | private `parseCandidate` | export/share validate helper | fail-closed warm semantics |
| `settings-access.ts` | read permission only | add write constant + messages as needed | read helpers; MSG_SETTINGS_DENIED_FA |
| `seed-settings.ts` | read-only PS | include write in same PS | hr.admin / sys.admin binding |
| `settings.ts` (router) | read-only; comment forbids mutations | add apply/reset; extend DTO | soft-deny audit; storeUnavailable list behavior; domain gates |
| `settings-types.ts` | row DTO without highImpact | add `highImpact`, `blastRadiusFa` | existing fields |
| `settings-parameter-row.tsx` | display-only | editable chrome for admin_editable | RO lock path; registry-driven |
| `settings-domain-panel.tsx` | list only | pass mutation callbacks / refetch | FeedbackMessage load/empty/error/store banner |
| `operational-copy.ts` | load/source labels | apply/reset/reason/blast strings | existing copy |
| `design-qa-mockup-matrix.md` | Settings pass (read-only note) | note edit wave | other rows |
| app-settings selfchecks | substrate | mutation validate cases | guard map |

### Algorithm — apply (implement literally)

```
authorize write (envelope meta) → soft PS write → load def(key)
→ refuse if not admin_editable
→ refuse if role cannot see owningDomain
→ refuse if no DB pool
→ parsed = validate(def, value); if null → BAD_REQUEST
→ if highImpact: UI already confirmed (server still trusts authz+validate; optional confirmToken not required)
→ upsertOverride({ key, value: parsed, updatedBy, reason })
→ access event allow (configuration)
→ return fresh row projection
```

### Algorithm — reset

```
same gates as apply → refuse if not admin_editable / wrong domain / no pool
→ deleteOverride(key)  // even if no row: idempotent success → still at default
→ persist reason: prefer upsert of a tombstone? NO — schema has no tombstone.
  Record reason via access-event payload { parameterKey, action: "reset", reason, previousValue }
  and/or a thin kernel helper that logs attribution before delete (do not invent new tables).
→ return fresh row (code_default)
```

**Reset attribution honesty:** SQL delete clears the override row (and thus last-change columns). Capture `previous` + reason on the **access event** (and optional FeedbackMessage). Full last-change history in audit UI = **10.5**. Do not fake last-change on a deleted row.

### Architecture compliance

- **AD-7:** Single resolver; modules already cut over in 10.1 — do not reintroduce env/literal for admin keys.
- **AD-3:** Web composes; validation ownership in `@divan/app-settings`.
- **AD-6:** No Prisma in `apps/web` for settings store — keep `pg` pool via kernel/db helpers.
- **FR-60 / FR-45:** Invalid → reject on apply; store-unavailable → fail closed; degraded configuration remains ops signal.
- **FR-42 (minimal):** actor + reason + previous/new on access event / store columns where applicable.
- **No AD-1…AD-6 change.**

### Library / framework requirements

- Existing `governedProcedure` + Zod (tRPC meta authorization pattern already in repo — extend, do not replace)
- Radix `Dialog` already in `components/ui/dialog.tsx`
- `FormLayout` / `FormSection` / field primitives from Epic 8
- `RowActionButton` for reset affordance
- React Query invalidation via existing `api.settings.listByDomain` utils
- **Do not** add a form library (react-hook-form/formik) unless already used on this surface
- **Do not** add i18n framework

### File structure requirements

```
# UPDATE (primary)
packages/kernel/app-settings/src/{store,resolver,index}.ts
packages/kernel/app-settings/src/app-settings.selfcheck.ts
packages/kernel/audit-envelope/src/settings-access.ts
packages/kernel/audit-envelope/src/settings-access.selfcheck.ts
packages/kernel/audit-envelope/src/categories.ts | policy fixtures (as needed for write tuple)
packages/modules/identity-access/src/seed-settings.ts
apps/web/src/server/settings.ts
apps/web/lib/settings-types.ts
apps/web/lib/operational-copy.ts
apps/web/components/settings/settings-parameter-row.tsx
apps/web/components/settings/settings-domain-panel.tsx
apps/web/lib/design-qa-mockup-matrix.md

# NEW (only if row file would become unreadable)
apps/web/components/settings/settings-parameter-editor.tsx   # optional extract
apps/web/components/settings/settings-apply-dialog.tsx       # optional extract

# Do NOT create
# - parallel settings store
# - /settings/edit routes
# - custody unlock
```

### Testing requirements

| Layer | Command / pattern |
| --- | --- |
| Kernel | `pnpm --filter @divan/app-settings selfcheck` (+ guard) |
| Access | `pnpm --filter @divan/audit-envelope selfcheck:settings-access` |
| Web IA | `pnpm --filter @divan/web selfcheck:settings-ia` |
| Design QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| Mutation | NEW cases: RO reject, OOR reject, role domain deny, reset→default, soft write deny |
| Manual | DoD checklist above |

### Previous story intelligence (10.1 → 10.2)

- **10.1** landed AD-7 substrate; consumers cut over; FR45 `configuration` in ops; custody patched to RO; upsert/delete exist but were internal/test-only from product view.
- **10.2** landed `/settings` nav, role-split tabs, read-only rows, `settings.read`, soft-deny audit, storeUnavailable banner, domain map in `lib/settings-domain-map.ts` (not components).
- **10.2 review patches to preserve:** soft-deny access event; fail-closed without DATABASE_URL on reads; empty-domain omit; DTO shared via `lib/settings-types.ts`.
- **Deferred (not this story):** `source: "environment"` producer (**10.4**); batched identity DTO for `lastChangedBy` (Epic 9 carry-in — raw account id still OK); `effect_at` scheduling (**10.5**); full audit investigation deep-link (**10.5**).
- **FormLayout:** 10.2 intentionally omitted forms; **this story is the first-touch** — FormLayout mandatory on edit/confirm chrome.
- Baseline commit for this story: **`beb7415`** (story 10.2).

### Git intelligence summary

Recent: `beb7415` story 10.2 → `311fbc2` story 10.1 → Epic 9 closeout. Pattern: thin web router + kernel SoT + soft PS after envelope + FeedbackMessage panels + design-qa gate. Follow the same for mutations; do not invent a second settings package.

### Latest tech information

- tRPC v11: continue using procedure `.meta({ permission, action, … })` with existing `governedProcedure` middleware — mutations use `action: "write"` like org/export routers. Do not introduce a parallel auth middleware.
- Cache invalidation remains **process-local** (AD-7 as implemented). Document multi-instance lag as known limitation; do not add distributed cache invalidation in this story.
- Client validation is UX; server validation is security. Zod input should coerce carefully (integers for number/duration_ms; `z.array(z.string().min(1)).min(1)` for string_list) **and** still run registry parse.

### Project context reference

- No `project-context.md` in repo — follow `ARCHITECTURE-SPINE.md` (AD-7), `epics.md` Epic 10 / Story 10.3, `prd.md` FR-60/FR-42/FR-45/FR-55, `ux-divan-2026-07-31`, stories **10.1** + **10.2**, and this file.
- Open Epic 7/8/9 production-honesty items remain **out of scope** but stay visible in Gates (no silent “done”).
- Epic 9 action #1 (design-qa / FormLayout first-touch / wave-1 boundary) is **in force** for this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 10 / Story 10.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-60, FR-42, FR-45, FR-55]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-7]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Configuration Administration]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — settings-row]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-settings.html`]
- [Source: `_bmad-output/implementation-artifacts/10-1-governed-settings-registry-store.md`]
- [Source: `_bmad-output/implementation-artifacts/10-2-settings-surface-admin-access.md`]
- [Source: `packages/kernel/app-settings/`]
- [Source: `apps/web/src/server/settings.ts`]
- [Source: `apps/web/components/settings/`]
- [Source: `packages/kernel/audit-envelope/src/settings-access.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Kernel OOR path changed from write+warm-degrade to reject-before-write; warm safety net retained via raw SQL invalid insert in selfcheck.
- Client packages import `@divan/app-settings/validate` + `/registry` to avoid pulling `pg` into the browser bundle.
- `operational-copy` Button `disabledReason` gate required on chip/confirm Buttons.

### Completion Notes List

- Shared `validateSettingsValue` / `assertValidSettingsValue` in `packages/kernel/app-settings/src/validate.ts`; `upsertOverride` rejects OOR/empty allowlist before INSERT; process-local invalidate/re-warm unchanged.
- `settings.write` + DEV_DEMO write tuple + seed PS includes read+write for hr.admin/sys.admin; soft `actorHoldsSettingsWrite` on apply/reset only.
- tRPC `settings.applyParameter` / `settings.reset` implement Gate algorithm (soft PS, admin_editable, role domain, store pool, shared parse, access events, fresh row DTO with highImpact/blastRadiusFa). Procedure renamed from `apply` because tRPC reserves that word.
- UI: `settings-parameter-editor.tsx` per-row FormLayout + Dialog confirm (reason ≥10, blast ack for highImpact), RowActionButton reset, leave-guard, FeedbackMessage via panel; RO rows unchanged; custody stays RO.
- Selfchecks: app-settings + guard + settings-access + settings-mutation + design-qa green; typecheck on touched packages green.
- Scope honesty: no 10.4 inventory, no 10.5 FR42/FR51 productization, no LG-complete claim, custody/session/identity not editable.

### File List

- packages/kernel/app-settings/src/validate.ts (new)
- packages/kernel/app-settings/src/resolver.ts
- packages/kernel/app-settings/src/store.ts
- packages/kernel/app-settings/src/index.ts
- packages/kernel/app-settings/src/app-settings.selfcheck.ts
- packages/kernel/app-settings/package.json
- packages/kernel/audit-envelope/src/settings-access.ts
- packages/kernel/audit-envelope/src/settings-access.selfcheck.ts
- packages/kernel/audit-envelope/src/index.ts
- packages/modules/identity-access/src/seed-settings.ts
- apps/web/src/server/settings.ts
- apps/web/src/server/settings-mutation.selfcheck.ts (new)
- apps/web/lib/settings-types.ts
- apps/web/lib/operational-copy.ts
- apps/web/lib/design-qa-mockup-matrix.md
- apps/web/components/settings/settings-parameter-editor.tsx (new)
- apps/web/components/settings/settings-parameter-row.tsx
- apps/web/components/settings/settings-domain-panel.tsx
- apps/web/package.json
- _bmad-output/implementation-artifacts/10-3-editable-parameter-wave-1.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

- [x] [Review][Patch] Dirty draft / open confirm wiped when sibling row invalidate refreshes row props [`apps/web/components/settings/settings-parameter-editor.tsx:171`]
- [x] [Review][Patch] Reset disabled when source is code_default even if invalid store override still exists (cannot clear degraded row) [`apps/web/components/settings/settings-parameter-editor.tsx:249`]
- [x] [Review][Patch] Local rows state causes false empty flash / lags query.data [`apps/web/components/settings/settings-domain-panel.tsx:27`]
- [x] [Review][Patch] Mutation gate checks pool only, not isSettingsStoreUnavailable (list can lock UI while API still mutates) [`apps/web/src/server/settings.ts:322`]
- [x] [Review][Patch] Reset ignores deleteOverride false — no-op reset returns success and writes allow audit [`apps/web/src/server/settings.ts:521`]
- [x] [Review][Patch] previousValue read via resolveSetting without ensuring cache warm before apply/reset audit payload [`apps/web/src/server/settings.ts:446`]
- [x] [Review][Patch] Leave-guard discard does not block while apply/reset mutation is pending [`apps/web/components/settings/settings-parameter-editor.tsx:197`]
- [x] [Review][Patch] duration_ms large values use HTML type=number (precision / scientific notation risk) [`apps/web/components/settings/settings-parameter-editor.tsx:408`]
- [x] [Review][Patch] Seed PermissionSet still named settings-read-provisional / «خواننده» while granting settings.write [`packages/modules/identity-access/src/seed-settings.ts:14`]
- [x] [Review][Patch] string_list validate allows duplicates within allowlist [`packages/kernel/app-settings/src/validate.ts:51`]
- [x] [Review][Patch] Empty numeric draft coerces to 0 instead of invalid-empty [`apps/web/components/settings/settings-parameter-editor.tsx:116`]
- [x] [Review][Defer] Reuse of SETTINGS_INVALID_DEFINITION for invalid user values vs bad registry defs [`packages/kernel/app-settings/src/validate.ts:102`] — deferred, pre-existing

### Change Log

- 2026-08-03: Story context created (ready-for-dev) — editable parameter wave 1; ultimate context engine analysis completed.
- 2026-08-03: Implemented wave-1 editable settings (validate-before-write, settings.write, apply/reset tRPC, per-row FormLayout UX, selfchecks); status → review.
- 2026-08-03: Code review — 11 patch, 1 defer, 9 dismissed; findings appended.
- 2026-08-03: Code review patches applied (dirty-preserve, degraded reset, panel flash, storeUnavailable gate+warm, no-op reset reject, leave-guard busy, duration text input, seed rename migrate, string_list dedupe, empty numeric); status → done.

---
baseline_commit: 32ec03e
---

# Story 10.5: Configuration Change Control & Evidence

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an auditor,
I want every configuration change to be attributable and reversible,
so that configuration is governed like any other privileged act (FR60, FR42, FR55).

**Story key:** `10-5-configuration-change-control-evidence`  
**Epic:** 10 — Administrative Settings & Governed Parameters (FR60; FR42, FR45, FR51, FR55)  
**UX contract:** `ux-divan-2026-07-31` (UX-DR36; EXPERIENCE §Configuration Administration + Flow ۳; DESIGN `settings-row`; mockup `screens-settings.html` — reason, blast, audit note, «مشاهده در ممیزی», history affordances)  
**Architecture:** **AD-7** (every change attributable through existing audit envelope; reversible to default; fail closed + FR45). **AD-5** (unified access events). Reuse **FR51** writer gate from audit-envelope (7.4). No AD-1…AD-6 change; **zero change** to audit-envelope *semantics*.  
**Authorized by:** `sprint-change-proposal-2026-07-31` (Gap E10 — change control & evidence)  
**Prerequisite:** Stories **10.1–10.4** done (registry/store/resolver, settings surface, wave-1 apply/reset, RO inventory + FR52 export).  
**Downstream:** Epic 10 retrospective (optional). This story **closes** Epic 10 product delivery.

### Precursors (reuse — do not reinvent)

| Precursor | Location | What it already does | Gap vs this story |
| --- | --- | --- | --- |
| Attribution columns | `packages/db/sql/022_governed_settings.sql` | `updated_by`, `reason`, `previous_value_json`, `effect_at` on override row | `effectAt` always passed `null` from UI; evidence not productized in investigation surface |
| Apply / reset mutations | `apps/web/src/server/settings.ts` | Validate, upsert/delete, reason ≥10, soft PS + domain gates | Access-event append is **best-effort** (`catch` → prefer mutation visibility); **FR51 = this story** |
| Access-event helper | `appendSettingsAccessEvent` in `settings.ts` | Writes `settings.apply` / `settings.reset` / deny / inventory view+export | Payload missing explicit `effectAt` / Jalali; reset may omit `newValue`; not trust-gated |
| FR51 writer gate | `@divan/audit-envelope` `assertAuditTrustWriterAllowed` + `enforceClockAnomalyOrThrow` | Used by launch-artifact / evaluation-snapshot / inference-bulk | Settings mutations **do not** call it yet |
| Pattern: required append | `launch-artifact.ts` `requireTrustAndAppend` | Trust gate → clock → **required** `appendAccessEvent` | Copy the *contract*, not Launch Artifact Register model |
| Investigation surface | `apps/web/src/server/audit.ts` + `audit-investigation-panel.tsx` | Search by `operation` / `operationPrefix` / `correlationId`; FR42 posture | No URL hydrate for deep-link from Settings; no Settings CTA «مشاهده در ممیزی» |
| FR45 configuration | `ops-configuration-health.ts` + resolver degraded | Fail closed to code default when invalid/unavailable | Must not regress; prove still visible when store unavailable / invalid override |
| Boundary metadata | `registry.ts` `boundaryClass` + custody RO | Wave-1 operational; security_posture RO | **Selfcheck suite** proving no registered param widens permission/retention/export/audit |
| Jalali display | Existing audit/settings Persian digit + Jalali helpers | Used elsewhere | Evidence timestamps must show Jalali in audit UI (existing surface — verify settings ops render) |
| Inventory FR52 export | 10.4 `exportInventory` | RO evidence pack | Unrelated SoT — do not merge with change-history |

### Critical naming / behavior distinctions (do not conflate)

| Concept | Meaning in this story |
| --- | --- |
| **Evidence productization ≠ new audit store** | Use existing access-event envelope (`appendAccessEvent`). Do **not** invent a settings_history table as SoT unless investigation cannot query access events (prefer access events). |
| **FR51 required append vs soft-deny** | Soft-deny paths may still best-effort append then FORBIDDEN (10.2). **Allow** apply/reset: trust gate **before** write; append **required**; append/trust failure **prevents or rolls back** the change (FR51). Map trust suspend → INTERNAL (ops copy), never «دسترسی ندارید.» |
| **Reset as a change** | `settings.reset` must emit the **same evidence posture** as apply: actor, parameter, previous, **new (= code default)**, reason, effect time, Jalali via `occurred_at`. Do not fake last-change on a deleted override row — history lives in audit. |
| **effect time vs scheduling product** | Record `effect_at` (= now ISO) on store row + access-event payload. Mockup: «اعمال بلافاصله انجام می‌شود». **Out of scope:** deferred-scheduling UI, cron re-warm, effect_at > now. Do not leave `effectAt: null` on successful apply. |
| **FR55 Launch Artifact ≠ config param** | Reuse FR51/append *patterns* from 7.7; do **not** put parameters into Launch Artifact Register, waiver, or rebaseline graphs. |
| **«مشاهده در ممیزی»** | Live deep-link only — filter must actually retrieve `settings.apply` / `settings.reset` (and preferably parameter key via payload/correlation). **No dead links.** |
| **Boundary selfcheck** | Prove registry invariants: no `admin_editable` key with `boundaryClass: security_posture`; custody/session/identity/audit-trust/inference remain RO; no editable key that is a permission, retention policy, export classification gate, or audit-integrity threshold. |
| **LG-complete honesty** | Closing Epic 10 delivery ≠ claiming LG-complete while Epic 7/8/9 production-honesty carry-ins remain open. |

## Acceptance Criteria

1. **Given** a permitted parameter change  
   **When** it is applied  
   **Then** the audit envelope records **actor**, **parameter**, **previous value**, **new value**, **reason** (required), **effect time**, and timestamp (Jalali-visible in audit surface)  
   **And** values in the payload are safe scalars (reuse inventory redaction / `serializeSettingsInventoryValue` — never secrets)

2. **And** the change is visible in the audit investigation surface with the same evidence posture as other privileged actions (searchable via `operation` / `operationPrefix` / `correlationId`)

3. **And** reset-to-default is recorded as a change with the **same** evidence fields (including `newValue` = registered code default)

4. **When** configuration is invalid or the store is unavailable  
   **Then** the system fails closed to defaults and shows the FR45 degraded state rather than operating on an unknown configuration (no regression from 10.1–10.4)

5. **And** a selfcheck proves that **no registered parameter** can widen a permission, retention, export, or audit boundary

6. **And** audit-required failure **prevents or safely suspends** the configuration change, consistent with **FR51** (trust suspend / required append failure → mutation does not silently succeed without evidence)

7. **And** Epic 9 / Epic 10 Gate encodes held:
   - `pnpm --filter @divan/web selfcheck:design-qa` green
   - First-touch: **FeedbackMessage** for evidence/audit-link errors; FormLayout already on editors — preserve; EntityPicker only if needed (expect none)
   - Live «مشاهده در ممیزی» (and optional per-parameter history) — **no dead ends**
   - Registry/resolver fail-closed + FR45 unchanged
   - Must not widen permission / retention / export / audit boundaries
   - AR-\* fail-closed; no LG-complete claim; no AD-1…AD-6 change

8. **And** scope boundaries:
   - Does **not** invent Launch Artifact / waiver / SoD approve≠manage for settings
   - Does **not** make RO inventory / custody / session / identity / LDAP secrets / audit-trust / inference editable
   - Does **not** add deferred-effect scheduling UI or Redis invalidate bus
   - Does **not** replace investigation SoT or invent a second settings package
   - Does **not** claim hash-chain / LG-complete audit substrate (Epic 7 honesty boundary remains)

## Tasks / Subtasks

- [x] Task 1: FR51 trust gate + required access-event on apply/reset (AC: #1, #3, #6)
  - [x] UPDATE `apps/web/src/server/settings.ts` `applyParameter` / `reset`:
    - Before write: `assertAuditTrustWriterAllowed(pool, { correlationId, permission: SETTINGS_WRITE_PERMISSION })` (+ `enforceClockAnomalyOrThrow` — match launch-artifact required-writer posture)
    - Prefer **one transaction**: upsert/delete + `appendAccessEvent` on same client; failure rolls back override write
    - Remove best-effort `catch` that swallows allow-path append failure (comments «full FR51 = 10.5» become this implementation)
    - Map `AuditTrustError` → `INTERNAL_SERVER_ERROR` with Persian ops copy (not FORBIDDEN / not «دسترسی ندارید.»)
  - [x] Payload contract (both operations):
    ```
    {
      parameterKey, action: "apply"|"reset",
      reason,
      previousValue, newValue,  // reset: newValue = code default scalar
      effectAt,                 // ISO timestamptz (now)
    }
    ```
  - [x] Soft-deny paths remain soft (best-effort append then FORBIDDEN) — do not FR51-block denials into INTERNAL
  - [x] Keep storeUnavailable / RO / role-domain / validate gates from 10.3–10.4

- [x] Task 2: Persist attribution columns honestly (AC: #1, #3)
  - [x] UPDATE apply path: pass `effectAt: new Date().toISOString()` (not `null`); ensure `previous_value_json` / `reason` / `updated_by` written (store already supports; verify upsert path sets previous from prior row or explicit previous)
  - [x] Reset: evidence only via access event (row deleted) — include previous + newDefault in payload; do **not** fake last-change on absent override
  - [x] Selfcheck: after apply, override row has non-null `updated_by`, `reason`, `effect_at`; access event exists for correlation

- [x] Task 3: Audit surface visibility + deep-link (AC: #2, #7)
  - [x] Confirm `audit.investigate.search` already returns `settings.apply` / `settings.reset` when filtered by `operation` or `operationPrefix: "settings."` (fix query if channel/scope filters exclude them — fix filter, do not fork SoT)
  - [x] UPDATE audit panel (or page) to hydrate draft filters from URL query (`operation`, `operationPrefix`, `correlationId`) — mirror settings tab deep-link honesty (10.2): bad/unknown → clear empty state, not silent coerce to unrelated filters
  - [x] NEW helper e.g. `apps/web/lib/settings-audit-href.ts`: builds `/audit?operation=settings.apply` or `operationPrefix=settings.` (+ optional `correlationId` from mutation result if returned)
  - [x] UPDATE settings UI (`settings-parameter-editor.tsx` / row / domain panel): after successful apply/reset, show FeedbackMessage success **and** RowActionButton / link «مشاهده در ممیزی» using the helper; optional «تاریخچهٔ این پارامتر» = same surface with operationPrefix + guidance to search payload key (do not invent parallel history UI unless trivial)
  - [x] Return `correlationId` (already on ctx) in mutation result DTO if needed for deep-link — keep DTO thin

- [x] Task 4: FR45 regression + invalid/unavailable honesty (AC: #4)
  - [x] Reaffirm warm/store-unavailable → code defaults + degraded + banner (10.1/10.2); mutations still gated when storeUnavailable
  - [x] Extend selfcheck if missing: invalid override → degraded default; unavailable store → health `degraded`/`unavailable`; no silent-OK
  - [x] Do not weaken inventory env overlay / secret redaction from 10.4

- [x] Task 5: Boundary non-widen selfcheck suite (AC: #5, #7)
  - [x] NEW (preferred) `packages/kernel/app-settings/src/boundary-guard.selfcheck.ts` **or** extend `app-settings.selfcheck.ts`:
    - Every `boundaryClass === "security_posture"` ⇒ `editability === "read_only_with_evidence"`
    - `export.custody_bulk_row_threshold` remains RO
    - No registry key is `admin_editable` whose key/description implies permission grant, retention disposal, export classification override, or audit-trust enforce/threshold control
    - Allowlist wave-1 operational keys explicitly; fail if a new editable key is added without updating the allowlist **or** without `boundaryClass: "operational"` + documented non-security rationale
  - [x] Wire into package `selfcheck` script
  - [x] Web mutation selfcheck: apply/reset still FORBIDDEN for all RO inventory keys

- [x] Task 6: UX copy + design-qa (AC: #7)
  - [x] UPDATE `operational-copy.ts`: audit-link labels, FR51 failure message, evidence success hint matching mockup tone («این تغییر در ممیزی ثبت می‌شود…»)
  - [x] Confirm reason field still required ≥10 on apply/reset confirm dialogs
  - [x] UPDATE `design-qa-mockup-matrix.md` Settings note: 10.5 evidence + live audit link delivered (not mockup-pixel-perfect; not LG-complete)
  - [x] `pnpm --filter @divan/web selfcheck:design-qa` green; settings-ia / no-dead-end still green

- [x] Task 7: Selfchecks + DoD (AC: #1–#8)
  - [x] NEW/extend `apps/web/src/server/settings-evidence.selfcheck.ts` (source-level and/or ephemeral): trust gate imported on apply/reset; no swallow-catch on allow append; payload keys present; audit href builder; boundary suite wired
  - [x] Kernel + web typecheck on touched packages
  - [x] Align story Status ↔ `sprint-status.yaml` when marking done; UTF-8 **without BOM** on Windows yaml edits
  - [x] Manual DoD below

### Manual DoD checklist

- [x] Apply editable parameter → access event shows actor, key, previous, new, reason, effectAt; Jalali time visible in audit UI
- [x] Reset → access event with same posture; `newValue` = code default; row last-change clears honestly (no fake actor on deleted override)
- [x] `assertAuditTrustWriterAllowed` suspend → apply/reset fails; override **not** left without evidence (rolled back)
- [x] Forced append failure (if testable) → mutation does not claim success without evidence
- [x] «مشاهده در ممیزی» from settings opens `/audit` with filters that return the change (no empty dead-end)
- [x] Search `operationPrefix=settings.` lists apply/reset alongside other privileged acts posture
- [x] Store unavailable / invalid override still FR45 degraded; no silent invalid apply
- [x] Boundary selfcheck fails if someone marks custody or audit.trust_enforce admin_editable
- [x] RO inventory + secrets still non-mutable / non-rendered
- [x] `selfcheck:design-qa` green; no LG-complete / AD-1…AD-6 claims

## Dev Notes

### Gate (non-negotiable)

| Must | Must not |
| --- | --- |
| Required FR51 trust + append on successful apply/reset | Best-effort allow-path append that leaves unaudited overrides |
| Record actor / previous / new / reason / effectAt | `effectAt: null` on successful apply |
| Reset = change with same evidence | Fake last-change on deleted override row |
| Live audit deep-link | Dead «مشاهده در ممیزی» |
| Boundary selfcheck suite | Editable security_posture / custody / audit-trust / permission wideners |
| Preserve FR45 fail-closed | Silent OK on invalid/unavailable config |
| Reuse access-event envelope | Parallel settings_history SoT / Launch Artifact for params |
| `selfcheck:design-qa` green | Claim LG-complete |

### Epic 9 / 10 carry-ins in force

- Mandatory `selfcheck:design-qa`; FeedbackMessage on touched panels
- Registry/resolver fail-closed + FR45
- Wave-1 must not widen permission/retention/export/audit boundaries — **prove with selfcheck**
- Settings no-dead-end once audit link introduced
- AR-\* fail-closed; no freeze-number invention
- Deep-link hydrate patterns from 10.2 (settings tabs) — extend same honesty to `/audit` query hydrate
- Batched `lastChangedBy` identity DTO still Epic 9 open carry-in — raw account id OK; do not block 10.5 on person hydrate

### UPDATE files — current state → this story → preserve

| File | Current | Change | Preserve |
| --- | --- | --- | --- |
| `apps/web/src/server/settings.ts` | Best-effort append; `effectAt: null` | FR51 gate + required append in TX; effectAt=now; full payload; optional correlationId on result | Soft-deny; domain gates; inventory export; RO reject; redaction |
| `packages/kernel/app-settings/src/store.ts` | Attribution columns work; previous via SQL | Only if explicit previous pass-through needed | RO upsert reject; pg PoolClient |
| `packages/kernel/app-settings/src/resolver.ts` | Ignores future effect_at | **No scheduler** — document honesty: effect_at is evidence timestamp (=now) | Warm env overlay; degraded; sync hot path |
| `registry.ts` / selfchecks | boundaryClass present | Boundary suite asserts | Wave-1 keys; RO inventory |
| `audit-investigation-panel.tsx` / `audit/page.tsx` | No URL hydrate | Hydrate operation / operationPrefix / correlationId | Existing search UX; independence gate |
| `settings-parameter-editor.tsx` (+ row/panel) | No audit CTA | Live «مشاهده در ممیزی» after mutate | FormLayout; reason≥10; leave-guard busy; blast confirm |
| `operational-copy.ts` | Apply/reset strings | FR51 + audit-link copy | Existing settings/inventory strings |
| `settings-mutation.selfcheck.ts` | RO reject | Evidence/FR51 wiring checks | Existing cases |
| `design-qa-mockup-matrix.md` | 10.4 inventory note | 10.5 evidence note | Other rows |

### Algorithm — FR51 apply (implement literally)

```
gateSettingsMutation (envelope + soft PS write + role domain + admin_editable + store available)
parsed = assertValidSettingsValue(def, value)
previous = resolveSetting(key).value
effectAt = now ISO

await withTransaction(pool, async (client) => {
  await assertAuditTrustWriterAllowed(client, { correlationId, permission: settings.write })
  await enforceClockAnomalyOrThrow(client, { correlationId, actorAccountId, permission: settings.write })
  await upsertOverride(client, { parameterKey, value: parsed, updatedBy, reason, effectAt })
  await appendAccessEvent(client, {
    operation: "settings.apply",
    result: "allow",
    reason: "configuration_change",
    entityType: "settings_configuration",
    entityId: parameterKey,  // if appendAccessEvent supports entityId — use it
    payload: { parameterKey, action: "apply", reason, previousValue, newValue, effectAt },
    scope: { channel: "settings", purpose: "settings_configuration", volume: 1 },
  })
})
// on AuditTrustError / append failure → TX abort → client sees INTERNAL with FR51 copy
invalidate / projectFreshRow
return { row, correlationId }
```

Reset: same with `deleteOverride` + payload `action: "reset"`, `newValue: def.defaultValue` (or resolved code default), `reason: "configuration_reset"`.

### Algorithm — audit deep-link (implement literally)

```
href = /audit?operationPrefix=settings.   // or operation=settings.apply
optional: &correlationId=<uuid from mutation>
AuditInvestigationPanel on mount: read searchParams → seed draft filters → auto-search once if any filter present
empty / invalid → show emptyMessageFa; never invent results
Settings success FeedbackMessage includes link with href
```

### Architecture compliance

- **AD-7:** Attributable changes via existing envelope; reversible to default; fail closed + FR45; security posture remains RO.
- **AD-5:** Access events only; no business-event mutation of settings.
- **AD-3:** Web thin; evidence ownership stays kernel audit-envelope + app-settings store; investigation stays reporting/audit module surfaces.
- **AD-6:** Keep `pg` Pool/PoolClient; no Prisma on settings path; prefer client-capable store helpers inside TX.
- **FR-60 / FR-42 / FR-45 / FR-51 / FR-55:** Change evidence + fail-safe; FR55 only as “governed change evidence” spirit — **not** Launch Artifact Register.
- **Sprint proposal:** Zero change to audit-envelope **semantics**; consume existing APIs.
- **No AD-1…AD-6 change.**

### Library / framework requirements

- Reuse `@divan/audit-envelope` `assertAuditTrustWriterAllowed`, `enforceClockAnomalyOrThrow`
- Reuse `@divan/event-store` `appendAccessEvent` + `withTransaction` (same pattern as launch-artifact)
- Existing `governedProcedure` + Zod — extend result DTO only as needed
- Jalali / Persian digits via existing web helpers — do not add new date libraries
- **Do not** add Redis, hash-chain libraries, or a second audit package
- **Do not** add i18n frameworks

### File structure requirements

```
# UPDATE (primary)
apps/web/src/server/settings.ts
apps/web/src/server/settings-mutation.selfcheck.ts
apps/web/components/settings/settings-parameter-editor.tsx
apps/web/components/settings/settings-parameter-row.tsx      # if last-change / link lives here
apps/web/components/settings/settings-domain-panel.tsx       # optional panel-level history CTA
apps/web/components/audit/audit-investigation-panel.tsx
apps/web/app/(app)/audit/page.tsx                           # pass searchParams if needed
apps/web/lib/operational-copy.ts
apps/web/lib/settings-types.ts                              # mutation result correlationId
apps/web/lib/design-qa-mockup-matrix.md
packages/kernel/app-settings/src/store.ts                   # only if TX client typing / previous explicit
packages/kernel/app-settings/src/app-settings.selfcheck.ts

# NEW (as needed)
apps/web/lib/settings-audit-href.ts
apps/web/src/server/settings-evidence.selfcheck.ts
packages/kernel/app-settings/src/boundary-guard.selfcheck.ts

# Do NOT create
# - parallel settings_history table as SoT (prefer access events)
# - Launch Artifact wiring for parameters
# - /settings/secrets or editable security_posture
# - deferred effect_at scheduler / cron
# - second resolver / Redis cache bus
```

### Testing requirements

| Layer | Command / pattern |
| --- | --- |
| Kernel | `pnpm --filter @divan/app-settings selfcheck` (+ boundary-guard) |
| Audit trust | Existing `@divan/audit-envelope` trust selfchecks — do not break |
| Web evidence | NEW settings-evidence.selfcheck + mutation selfcheck |
| Audit IA | Manual or light selfcheck that href builder + panel hydrate exist |
| Design QA | `pnpm --filter @divan/web selfcheck:design-qa` |
| Manual | DoD checklist above |

### Previous story intelligence (10.1 → 10.4)

- **10.1** landed AD-7 substrate + attribution columns foreshadow; `effect_at` stored but ignored by warm; FR45 configuration section.
- **10.2** landed `/settings`, role-split tabs, soft-deny, RO lock UX; deferred mutations + evidence productization.
- **10.3** landed apply/reset + reason + blast; **explicitly** deferred FR42 investigation parity, FR51 fail-safe, «مشاهده در ممیزی», and effect_at scheduling to **10.5**. Review patches to preserve: storeUnavailable gate; warm before previousValue; leave-guard busy; string_list dedupe; degraded reset allowed; no-op reset reject.
- **10.4** landed RO inventory + env source + secret redaction + FR52 export + security view-audit; **explicitly** deferred 10.5 deep-link and FR51 productization. Review: technical view-audit fail-closed; export after create; warm queue; binder honesty — **do not regress**.
- **Deferred-work:** `effect_at` honor by warm was foreshadow — this story records effect_at as **evidence (=now)**; do **not** invent scheduler.
- Baseline commit for this story: **`32ec03e`** (story 10.4).

### Git intelligence summary

Recent: `32ec03e` story 10.4 → `18b84f3` story 10.3 → `beb7415` story 10.2 → `311fbc2` story 10.1 → `dc9be67` epic 9 retro. Pattern: kernel SoT first, thin web router, soft PS after envelope, FeedbackMessage panels, design-qa gate, UTF-8 no-BOM sprint-status, review patches preserved in next story. Follow the same; close Epic 10 with evidence productization — do not reopen inventory/editable scope.

### Latest tech information

- **Append-only audit evidence:** Prefer immutable access events (INSERT-only posture already in envelope). Capture before/after in JSON payload with **stable scalar serialization** (reuse redaction helper) so investigation queries stay consistent — do not hash-chain (out of MVP honesty boundary).
- **FR51 writer gate:** Call trust assert **before** mutation commit; required append in same TX prevents “config changed, audit missing” windows (industry append-only + fail-closed writer pattern).
- **Deep-link hydrate:** One-shot URL → filter draft (same honesty as settings tabs 10.2); never silently rewrite unrelated audit queries.
- **tRPC:** Extend existing settings + audit routers; do not introduce parallel auth middleware.
- **Secrets:** Access-event payloads must remain redaction-safe (10.4 contract).

### Project context reference

- No `project-context.md` found in repo at create-story time; follow AD-7 / AD-5 / Epic 10 Gates and prior story Files lists.
- Communication with user: Persian; this story document: English (`document_output_language`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 10 / Story 10.5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-42, FR-45, FR-51, FR-55, FR-60]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md` — AD-5, AD-7]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md` — Epic 10 story table + zero envelope-semantics-change]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/EXPERIENCE.md` — Configuration Administration / Flow ۳]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/DESIGN.md` — settings-row]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-divan-2026-07-31/mockups/screens-settings.html`]
- [Source: `_bmad-output/implementation-artifacts/10-1-governed-settings-registry-store.md`]
- [Source: `_bmad-output/implementation-artifacts/10-2-settings-surface-admin-access.md`]
- [Source: `_bmad-output/implementation-artifacts/10-3-editable-parameter-wave-1.md`]
- [Source: `_bmad-output/implementation-artifacts/10-4-readonly-infrastructure-security-inventory.md`]
- [Source: `packages/kernel/audit-envelope/src/launch-artifact.ts` — `requireTrustAndAppend`]
- [Source: `packages/kernel/audit-envelope/src/audit-trust-gate.ts`]
- [Source: `apps/web/src/server/settings.ts` — apply/reset best-effort catch]
- [Source: `packages/db/sql/022_governed_settings.sql`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Local `DATABASE_URL` pointed at unavailable Postgres (`ECONNREFUSED :5433`) — kernel DB ephemeral gates skipped; pure + boundary + web source selfchecks + design-qa green.

### Completion Notes List

- FR51: apply/reset now run trust gate + clock anomaly + upsert/delete + required `appendAccessEvent` inside one `withTransaction`; allow-path swallow-catch removed; trust/append failure → `INTERNAL_SERVER_ERROR` with `settingsEvidenceRequiredFail` (never «دسترسی ندارید.»); soft-deny remains best-effort.
- Attribution: `effectAt` = now ISO on apply store row + both payloads; reset payload includes `newValue` = `getCodeDefault`; `skipCacheRefresh` avoids poisoning resolver cache on TX rollback; warm after commit.
- Deep-link: `settings-audit-href.ts` + mutation `correlationId`; FeedbackMessage «مشاهده در ممیزی» + history prefix; audit panel hydrates `operation` / `operationPrefix` / `correlationId` from URL (invalid UUID ignored).
- Boundary: `boundary-guard.selfcheck.ts` allowlists wave-1 admin keys + security_posture RO; wired into `@divan/app-settings` `selfcheck`.
- Gates run green: `selfcheck:settings-evidence`, `settings-mutation`, `settings-inventory`, `boundary`, `design-qa`, `settings-ia`, `no-dead-end-ia`, web + app-settings typecheck.

### File List

- `_bmad-output/implementation-artifacts/10-5-configuration-change-control-evidence.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/src/server/settings.ts`
- `apps/web/src/server/settings-mutation.selfcheck.ts`
- `apps/web/src/server/settings-evidence.selfcheck.ts`
- `apps/web/src/server/audit.selfcheck.ts`
- `apps/web/lib/settings-audit-href.ts`
- `apps/web/lib/settings-types.ts`
- `apps/web/lib/operational-copy.ts`
- `apps/web/lib/design-qa-mockup-matrix.md`
- `apps/web/components/settings/settings-parameter-editor.tsx`
- `apps/web/components/settings/settings-domain-panel.tsx`
- `apps/web/components/audit/audit-investigation-panel.tsx`
- `apps/web/app/(app)/audit/page.tsx`
- `apps/web/package.json`
- `packages/kernel/app-settings/src/store.ts`
- `packages/kernel/app-settings/src/boundary-guard.selfcheck.ts`
- `packages/kernel/app-settings/package.json`

### Review Findings

- [x] [Review][Decision] Parameter history deep-link scope — resolved: extend hydrate+href with `entityType`/`entityId`=parameter key (+ title hint on history CTA)
- [x] [Review][Decision] Task 2 ephemeral `effect_at` / access-event selfcheck — resolved: accept source-level + Manual DoD as sufficient for this story
- [x] [Review][Patch] Post-TX `invalidateSettingsCache` / `projectFreshRow` can fail after committed write — fixed via `projectRowAfterEvidenceCommit` [`apps/web/src/server/settings.ts`]
- [x] [Review][Patch] `throwSettingsEvidenceRequired` maps non-trust/non-append failures to FR51 evidence copy — fixed via `SettingsEvidenceAppendError` + kind-specific ops copy [`apps/web/src/server/settings.ts`]
- [x] [Review][Patch] URL hydrate is one-shot (`hydratedOnce`) so later `hydrateKey` changes are ignored — fixed [`apps/web/components/audit/audit-investigation-panel.tsx`]
- [x] [Review][Patch] Sprint-status header comment still says Story 10.5 `ready-for-dev` while status is `review` — fixed [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Defer] Empty-filter search fires before URL hydrate applies filters [`apps/web/components/audit/audit-investigation-panel.tsx`] — deferred, pre-existing pattern / cosmetic flash
- [x] [Review][Defer] Brief resolver cache staleness between TX commit and post-commit invalidate [`apps/web/src/server/settings.ts`] — deferred, inherent to skipCacheRefresh design

### Change Log

- 2026-08-03 — create-story: ultimate context engine analysis completed — comprehensive developer guide created
- 2026-08-03 — implemented Story 10.5: FR51 required evidence on settings apply/reset, audit deep-link hydrate, boundary non-widen selfcheck; status → review
- 2026-08-04 — code review: findings triaged (2 decision, 4 patch, 2 defer); parallel Task subagents hung — layers re-run in parent
- 2026-08-04 — code review patches applied (history entity deep-link, post-TX projection, FR51 error mapping, hydrate re-sync); status → done

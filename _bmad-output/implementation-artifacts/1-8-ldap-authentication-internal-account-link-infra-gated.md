---
baseline_commit: df7a304
---

# Story 1.8: LDAP Authentication & Internal Account Link (Infra-Gated)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a launch user,
I want to authenticate against organization LDAP/AD linked to one internal account,
so that production identity uses the directory and passwords are never stored in the app (FR1, FR49).

## Gate (read first)

**This story is blocked until Infrastructure approves LDAP/AD connectivity** (topology, bind/trust, attributes, acceptance environment).

- Do **not** invent LDAPS endpoints, Base DN, bind DN, attribute names, MFA, production session timeouts, or emergency-account rules.
- Implement behind `IDENTITY_PROVIDER=ldap` using **placeholder env keys** whose values come only from Infra/AR-IDENTITY sign-off.
- Until Infra approval: keep `IDENTITY_PROVIDER=seeded` as the routine local/CI path; LDAP code may ship dark (fail-closed when misconfigured) but must not enable production cutover without the gate.
- Formal AR-IDENTITY still open for: topology, MFA/conditional access, concurrent-session/lockout numbers, emergency account, group→role sync. Do not claim those frozen.

[Source: `epics.md` Story 1.8 Gate; `identity-access-epic1-freeze.md`; `infra-security-brief.md`; `launch-artifacts.md` AR-IDENTITY]

## Acceptance Criteria

1. **Given** AR-IDENTITY-compatible LDAP/AD connectivity is configured and Infrastructure-approved for the environment  
   **When** a user signs in with a valid mapped directory identity  
   **Then** the system creates or links exactly one internal account for that identity (FR1, FR49)  
   **And** the application never stores the user's LDAP password

2. **When** the identity is disabled, locked, expired, removed, duplicate, or unmapped  
   **Then** authentication fails closed per AR-IDENTITY rules without silent bypass

3. **When** the directory is unavailable  
   **Then** the login surface shows «اتصال به سامانه هویت برقرار نیست.» and no routine local/seeded access is created in LDAP mode

4. **And** production builds do not fall back to seeded credentials when LDAP is the active provider

5. **And** existing MVP coarse roles remain assignable to LDAP-linked accounts without changing Epic-1 landings

## Tasks / Subtasks

- [x] Task 1: Schema — external directory link + no LDAP password storage (AC: #1, #4)
  - [x] Extend `packages/db/prisma/schema.prisma` `InternalAccount` (and/or `HumanIdentity`) with a **stable external directory identifier** field (unique, nullable for seeded-only rows) — name e.g. `externalDirectoryId`
  - [x] Make `passwordHash` **nullable** (or provider-specific): seeded accounts keep hashes; LDAP-linked accounts **must** persist `passwordHash = null` and never write the directory password
  - [x] Add Prisma migration under `packages/db/prisma/migrations/`
  - [x] Preserve 1:1 `HumanIdentity` ↔ `InternalAccount`; no shared accounts; no Person/HR tables

- [x] Task 2: LDAP config seam (AC: #3, #4 — Gate)
  - [x] Extend `packages/modules/identity-access/src/config.ts` to read LDAP connection settings **only from env** (document keys in `.env.example` as comments / empty placeholders)
  - [x] Suggested keys (values filled by Infra — do not hardcode org topology): `LDAP_URL` (prefer `ldaps://…:636`), `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`, `LDAP_USER_FILTER` / attribute names for login + immutable id, TLS trust options as Infra specifies
  - [x] When `IDENTITY_PROVIDER=ldap` and required config is missing/invalid → treat as directory unavailable (`PROVIDER_UNAVAILABLE`) — **never** fall back to seeded
  - [x] Keep `getIdentityProvider()` behavior: unknown provider → `null` (fail-closed, not seeded)

- [x] Task 3: LDAP adapter + authenticate branch (AC: #1, #2, #3, #4)
  - [x] Add LDAP client dependency on `@divan/identity-access` only: prefer **`ldapts`** (TypeScript-native; supports `ldaps://` + `tlsOptions`; current line ~9.x as of 2026-07)
  - [x] New module file(s), e.g. `src/ldap-client.ts` / `src/ldap-authenticate.ts` — **all** directory I/O lives here; do not call LDAP from React, Auth.js, or `apps/web` directly
  - [x] Refactor `authenticate.ts`:
    - `seeded` → existing bcrypt path (unchanged semantics; still refused when `NODE_ENV=production`)
    - `ldap` → directory verify + link/create; **never** bcrypt-compare LDAP password against DB
    - `null` / misconfigured → `PROVIDER_UNAVAILABLE`
  - [x] Align module outage `messageFa` with freeze/UX exact string: «اتصال به سامانه هویت برقرار نیست.» (replace current seeded-oriented `MSG_PROVIDER` for LDAP/null paths; seeded misconfig may keep a distinct operator-facing message if needed)
  - [x] Directory outcomes → fail-closed codes (map to existing UI codes where possible):
    | Directory outcome | Auth behavior |
    | --- | --- |
    | Connect/bind/search timeout, TLS failure, server down | `PROVIDER_UNAVAILABLE` |
    | User not found / bad password | `INVALID_CREDENTIALS` (same Persian as seeded — no user enumeration) |
    | Disabled / locked / expired / removed | fail-closed (`INVALID_CREDENTIALS` or `INACTIVE_ACCOUNT` if already linked inactive — pick one policy and document; no silent bypass) |
    | Duplicate external id / conflicting link | fail-closed (`INVALID_CREDENTIALS` or typed code) — never merge silently |
    | Unmapped (no link rule / no create mapping) | fail-closed — **not** auto-Viewer |
  - [x] Continue recording `AuthAttempt` (FR42 substrate); do **not** log passwords, bind secrets, or raw LDAP payloads
  - [x] Always `unbind` / close LDAP client in `finally`

- [x] Task 4: Create-or-link internal account (AC: #1, #5)
  - [x] Resolve order (fail closed on ambiguity):
    1. Find `InternalAccount` by `externalDirectoryId` (immutable id from Infra-approved attribute)
    2. Else find by username awaiting first link (if policy allows) and set `externalDirectoryId`
    3. Else **create** `HumanIdentity` + `InternalAccount` only when an **explicit mapping** allows create (see Dev Notes — do **not** invent AD group→role sync)
  - [x] On create/link: set `passwordHash = null`; set `username` to the login identifier used by `getActiveCoarseRoleByUsername` post-login (Story 1.5 pattern)
  - [x] Coarse role: must be one of the five MVP codes; assignable without changing `navigation.ts` landings
  - [x] Inactive linked account → `INACTIVE_ACCOUNT` (preserve seeded copy)

- [x] Task 5: Web login UI + Auth.js wiring (AC: #3, #4, #5)
  - [x] `apps/web/components/login-form.tsx` `mapAuthError`: map `PROVIDER_UNAVAILABLE` → `operationalCopy.ldapUnavailable` (closes deferred-work from 1.4)
  - [x] Ensure `login-action` / Auth.js `DivanCredentialsSignin` still propagates `PROVIDER_UNAVAILABLE` (today `authorize` already rethrows `AuthenticationError.code` — do not swallow it into `INVALID_CREDENTIALS`)
  - [x] Rename Credentials provider display name from `"Seeded"` to something provider-neutral (e.g. `"Divan"`) — cosmetic only
  - [x] Do **not** change role landings, nav matrix, or post-login `resolvePostLoginPath` / `getActiveCoarseRoleByUsername` contract
  - [x] Keep `(auth)/login` outside AppShell chrome

- [x] Task 6: Production / seed cutover guards (AC: #3, #4)
  - [x] When `IDENTITY_PROVIDER=ldap`: seeded verify path unreachable; `ALLOW_DEV_SEED` seed must not create a routine login bypass
  - [x] When `NODE_ENV=production` + ldap: no silent seed fallback (already partially guarded — verify end-to-end)
  - [x] Document cutover in README / `.env.example`: seeded for local/CI; ldap only after Infra approval
  - [x] Optional: implement or explicitly defer `signOut` module hook for server-side revoke (JWT stale role after demote — deferred-work 1.5); if deferred, note in Completion Notes + `deferred-work.md`

- [x] Task 7: Manual DoD + optional selfcheck (AC: #1–#5)
  - [x] `pnpm --filter @divan/web lint` + `typecheck`; identity-access typecheck
  - [x] Smoke matrix (see Testing): seeded still works when `IDENTITY_PROVIDER=seeded`; ldap mode outage + mapped success + fail-closed cases (mock or Infra test directory)
  - [x] Optional `ldap-auth.selfcheck.ts` asserting outage copy string + provider routing invariants (run via `tsx`; CI wiring still deferred)
  - [x] Update `deferred-work.md`: mark `PROVIDER_UNAVAILABLE` UI mapping resolved; carry forward any leftover session-revoke items

### Review Findings

- [x] [Review][Patch] Binary directory ID encoding — encode `Buffer` attrs as lowercase hex (not utf8); document in `.env.example` that binary ids (e.g. `objectGUID`) are hex-encoded and pre-provision must match [`ldap-client.ts:attrString`] — decided: hex (2026-07-16)
- [x] [Review][Patch] Account-state ATTR without VALUES — if ATTR set but VALUES empty, ignore that ATTR (do not treat any truthy as blocked); document that Infra must supply both [`ldap-client.ts:attrMatches`] — decided: require VALUES (2026-07-16)
- [x] [Review][Defer] Invalid `LDAP_CREATE_MAPPING_JSON` → entire LDAP unavailable — deferred, intentional fail-closed; empty/omitted stays create-forbidden; typo correctly takes config down — decided: keep current (2026-07-16)
- [x] [Review][Defer] Default `uid`/`cn` for login/display attributes — deferred, keep common LDAP placeholders; Infra still must set required keys — decided: keep defaults (2026-07-16)
- [x] [Review][Patch] Post-login landing lookup uses form username while LDAP may store `loginAttribute` as `InternalAccount.username` — mismatch clears session as INVALID_CREDENTIALS [`apps/web/lib/login-action.ts:37` / `ldap-client.ts:83-94`] — fixed: store submitted username
- [x] [Review][Patch] Repeat login does not persist `displayName` when username already matches — JWT refresh restores stale DB name [`ldap-link.ts:87-102`] — fixed: always update displayName
- [x] [Review][Patch] Concurrent create-on-first-login can throw Prisma unique (P2002) and surface as opaque INVALID_CREDENTIALS — wrap create + catch/re-fetch [`ldap-link.ts:154-168`] — fixed
- [x] [Review][Patch] Seed upsert always writes `passwordHash` — if a seeded username was previously LDAP-linked, re-seed under `seeded` restores a local hash while leaving `externalDirectoryId` [`seed.ts:99-107`] — fixed: clear externalDirectoryId on reclaim
- [x] [Review][Defer] STARTTLS not supported for `ldap://` — deferred, pre-existing Infra topology gate; wait for AR-IDENTITY approved topology
- [x] [Review][Defer] Module `signOut` / JWT stale role after demote — deferred, pre-existing (already in deferred-work)
- [x] [Review][Defer] `ldap-auth.selfcheck` coverage/CI wiring limited — deferred, pre-existing pattern until Vitest/CI story
- [x] [Review][Defer] Directory account state only checked at login (not JWT refresh) — deferred, pre-existing JWT session model; AD revalidation out of 1.8 scope
- [x] [Review][Defer] Non-49 LDAP bind codes (e.g. password expired) map to unavailable — deferred pending AR-IDENTITY account-state code map

## Dev Notes

### Epic context

- **Epic 1:** Secure Access & Persian Desktop Shell — production identity path after seeded bootstrap.
- **FRs:** FR1 (LDAP/AD + no password storage + Persian outage); FR49 (1 human ↔ 1 account; outage never creates routine local access); FR42 attribution continues as thin substrate; NFR7 timeouts remain **hooks** (dev defaults) until AR-IDENTITY freezes numbers.
- **Upstream:** 1.4 provider seam + Auth.js + projections; 1.5 landings/nav (must not change); 1.7 `operationalCopy.ldapUnavailable` catalog string.
- **Downstream:** Epic 2 access admin / account-link UI (FR4); Story 7.2 ops identity health; break-glass (2.5) is **not** this story.

### Absolute non-goals

| Deferred | Where |
| --- | --- |
| Invent LDAP topology / bind / MFA / emergency account | Infra + AR-IDENTITY |
| AD/LDAP **group → coarse role** automatic sync | AR-IDENTITY open |
| Fine-grained permission × category × scope | Epic 2 / audit-envelope |
| Break-glass / emergency local IdP alternate | FR-46 / Story 2.5 — not routine seed fallback |
| Change five MVP roles or Epic-1 landings | Frozen 1.4/1.5 |
| Passport / Lucia / Better Auth | Auth.js already chosen |
| Import `@divan/identity-access` from client components | Pulls `pg` — lessons 1.5/1.6 |
| Full audit envelope / retention on `AuthAttempt` | Epic 2 / 7 |
| Claim production AR-IDENTITY session/MFA compliance | Explicit non-claim |

### Create-or-link policy (until group→role is frozen)

**Mapped** means Infra/AR-IDENTITY-approved rules, implemented as config — not guessed AD groups:

1. **Preferred:** Pre-provisioned `InternalAccount` rows with `externalDirectoryId` (+ coarse role already assigned). Login links/uses that row.
2. **Create-on-first-login:** Allowed only via explicit allowlist mapping (e.g. env/JSON: directory id or username → one of five `CoarseRole` values). Missing mapping = **unmapped** → fail closed.
3. **Forbidden:** Silent default role, Viewer elevation, or “everyone gets hr_operator”.

### Architecture compliance

| Rule | Implication |
| --- | --- |
| AD-5 | Auth + coarse role in `identity-access`; fine authz stays in audit-envelope |
| Spine | `LDAP/AD → identity-access`; no password storage; logs redact LDAP secrets |
| Infra brief | Prefer LDAPS `:636`; secure bind; outage fail-closed |
| Session | Keep Auth.js JWT + idle/absolute hooks; Credentials still call only `authenticate()` |

[Source: `ARCHITECTURE-SPINE.md`; `infra-security-brief.md`; Story 1.4]

### Current code to UPDATE (read before coding)

| File | Current state | This story changes | Preserve |
| --- | --- | --- | --- |
| `packages/modules/identity-access/src/authenticate.ts` | Seeded-only; non-seeded → `PROVIDER_UNAVAILABLE` with seeded-oriented MSG; `signOut` no-op | Branch `ldap`; outage copy; link/create; never store LDAP password | Seeded bcrypt semantics; AuthAttempt best-effort; `getSessionContext` / `getActiveCoarseRoleByUsername` |
| `packages/modules/identity-access/src/config.ts` | `seeded`/`ldap`/`null` + timeouts | LDAP env readers; missing ldap config → unavailable | Unknown provider ≠ seeded |
| `packages/modules/identity-access/src/types.ts` | Three error codes; outcomes | Optional outcome strings for LDAP failures; keep public error codes stable for UI | Five `COARSE_ROLES` |
| `packages/db/prisma/schema.prisma` | `passwordHash String` required; no external id | Nullable hash + unique external directory id | Identity-only models |
| `apps/web/components/login-form.tsx` | Maps only inactive → else invalid credentials | Map `PROVIDER_UNAVAILABLE` → `ldapUnavailable` | RTL form, role=alert |
| `apps/web/auth.ts` | Credentials name `"Seeded"`; rethrows `AuthenticationError.code` | Neutral name; ensure outage code not swallowed | JWT idle/absolute; authorize → `authenticate()` only |
| `apps/web/lib/operational-copy.ts` | `ldapUnavailable` cataloged | Wire only — **do not change the string** | Exact freeze wording |
| `.env.example` / `README.md` | Documents seeded + `IDENTITY_PROVIDER=ldap` comment | LDAP placeholder keys + cutover warnings | Dev seed table remains non-prod |

### Library / framework requirements

| Lib | Use |
| --- | --- |
| **Auth.js v5** (`next-auth`) | Unchanged session strategy; Credentials → module |
| **`ldapts`** | LDAP/LDAPS client inside identity-access only (~9.x; prefer LDAPS + `tlsOptions` per Infra) |
| **bcryptjs** | Seeded path only |
| **Prisma 7** + `@divan/db` | Migration for schema; no `@prisma/client` from web |

Do **not** add `ldapjs` (legacy) unless `ldapts` is blocked by Infra — document rationale if so.

### Project structure notes

```
packages/modules/identity-access/src/
  authenticate.ts          # UPDATE — provider switch
  config.ts                # UPDATE — LDAP env
  types.ts                 # UPDATE — as needed
  ldap-*.ts                # NEW — directory adapter
  navigation.ts            # LEAVE (landings frozen)
apps/web/
  components/login-form.tsx
  auth.ts
  lib/operational-copy.ts  # wire only
packages/db/prisma/schema.prisma + migrations/
```

### Previous story intelligence

- **1.4:** Provider seam, fail-closed codes, AuthAttempt, production seed block, Auth.js JWT — extend, do not replace.
- **1.5:** After `signIn`, resolve landing via `getActiveCoarseRoleByUsername` (same-request `auth()` unreliable). JWT `coarseRole` can stale after demote — revoke optional in 1.8+.
- **1.6/1.5:** Never import identity-access barrel from client.
- **1.7:** Outage copy already in catalog + selfcheck — wire UI; do not alter string.
- **Deferred:** `PROVIDER_UNAVAILABLE` UI mapping is **this story’s job**.

### Git intelligence

Recent commits: `df7a304` 1.7 → `12af889` 1.6 → `4629aba` 1.5 → `abbe8ba` 1.4. Follow `story 1.8` commit style; keep seeded path green for local/CI.

### Latest tech notes (`ldapts`)

- Use `ldaps://host:636` with `tlsOptions` (e.g. `minVersion: 'TLSv1.2'`, CA as Infra provides). Do not disable `rejectUnauthorized` unless Infra explicitly documents a lab-only exception.
- Pattern: bind (service or user) → search → user bind to verify password → unbind in `finally`.
- Never persist the password argument; never log it.

### Testing requirements

Epic-1 DoD remains **manual smoke + lint/typecheck** (Vitest/Playwright not mandatory yet).

| Case | Expect |
| --- | --- |
| `IDENTITY_PROVIDER=seeded` | Five seeded logins + fail-closed still work |
| `IDENTITY_PROVIDER=ldap` + directory down / bad TLS / missing env | Login shows «اتصال به سامانه هویت برقرار نیست.»; no seed login |
| `IDENTITY_PROVIDER=ldap` + valid mapped user | One internal account linked/created; `passwordHash` null; session + correct landing |
| Disabled/locked/expired/removed/duplicate/unmapped | Fail closed; no privilege elevation |
| `IDENTITY_PROVIDER=ldap` in production-like env | No seeded credential success path |
| Landings | Unchanged vs 1.5 matrix for each coarse role |
| Logs | No bind password / user password / LDAP secrets |

Optional: mock LDAP server or Infra lab directory per addendum §12.2 (identity/link/outage/certificate).

### Project context reference

No `project-context.md` found in repo. Follow this story + `identity-access-epic1-freeze.md` + Stories 1.4/1.5 Dev Notes.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 1.8
- `_bmad-output/specs/spec-divan/identity-access-epic1-freeze.md`
- `_bmad-output/specs/spec-divan/SPEC.md` — LDAP deferred until Infra
- `_bmad-output/planning-artifacts/prds/prd-divan-2026-07-11/prd.md` — FR-1, FR-49, NFR-7
- `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/ARCHITECTURE-SPINE.md`
- `_bmad-output/planning-artifacts/architecture/architecture-divan-2026-07-15/infra-security-brief.md`
- `_bmad-output/implementation-artifacts/1-4-seeded-accounts-coarse-role-auth-dev-bootstrap.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `apps/web/lib/operational-copy.ts` — `ldapUnavailable`
- `packages/modules/identity-access/src/{authenticate,config,types}.ts`

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Type narrowing: split LDAP/link result unions into per-kind objects so `kind !== "ok"` narrows correctly under tsc.
- PowerShell: chained `&&` unsupported — used sequential `;` + `$LASTEXITCODE` checks.

### Implementation Plan

1. Schema: nullable `passwordHash` + unique nullable `externalDirectoryId`; migration applied.
2. Config: `getLdapConfig()` env-only; missing/invalid → null → `PROVIDER_UNAVAILABLE`.
3. `ldapts` adapter (`ldap-client.ts`) + link/create (`ldap-link.ts`) + provider switch in `authenticate.ts`.
4. UI: wire outage copy; Credentials name `Divan`; seed refuses under `IDENTITY_PROVIDER=ldap`.
5. Docs + `ldap-auth.selfcheck.ts`; defer module `signOut` revoke.

### Completion Notes List

- LDAP path ships dark behind `IDENTITY_PROVIDER=ldap`; local/CI remains `seeded`.
- Policy: directory disabled/locked/expired → `INVALID_CREDENTIALS` (no enumeration); already-linked inactive → `INACTIVE_ACCOUNT`; unmapped/conflict → `INVALID_CREDENTIALS` (no auto-Viewer).
- Create-on-first-login only via `LDAP_CREATE_MAPPING_JSON` (directory id or username → one of five MVP roles).
- Directory passwords never persisted (`passwordHash = null` on link/create); client always `unbind` in `finally`.
- Module `signOut` server-side revoke deferred (noted in `deferred-work.md`).
- Validations: identity-access + web typecheck, web lint, `ldap-auth.selfcheck` + `navigation.selfcheck` ok; migration deployed locally.

### File List

- `.env.example`
- `README.md`
- `_bmad-output/implementation-artifacts/1-8-ldap-authentication-internal-account-link-infra-gated.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/auth.ts`
- `apps/web/components/login-form.tsx`
- `apps/web/lib/operational-copy.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260716183000_ldap_external_directory_link/migration.sql`
- `packages/modules/identity-access/package.json`
- `packages/modules/identity-access/src/authenticate.ts`
- `packages/modules/identity-access/src/config.ts`
- `packages/modules/identity-access/src/index.ts`
- `packages/modules/identity-access/src/ldap-auth.selfcheck.ts`
- `packages/modules/identity-access/src/ldap-client.ts`
- `packages/modules/identity-access/src/ldap-link.ts`
- `packages/modules/identity-access/src/seed.ts`
- `packages/modules/identity-access/src/types.ts`
- `pnpm-lock.yaml`

### Change Log

- 2026-07-16: Implemented Story 1.8 — LDAP/AD auth seam (infra-gated), internal account link/create, UI outage mapping, seed cutover guards.
- 2026-07-16: Code review patches — hex binary ids, ATTR+VALUES gating, submitted username for landing, displayName refresh, P2002 race recovery, seed reclaim clears externalDirectoryId.

---

**Status:** done

/**
 * Person identity + Data Dictionary governed router (Stories 3.1 / 3.3 / FR-5 / FR-7).
 * Coarse hr_admin / hr_operator unlock nav only — mutations require
 * `person.write` / `person.read` via PermissionSet + envelope.
 * Story 4.9: thin current-state read (`getCurrentState`).
 */
import {
  DEV_DEMO_CATEGORIES,
  EvaluationSnapshotError,
} from "@divan/audit-envelope";
import { COMPENSATION_DATA_CATEGORY } from "@divan/compensation-facts";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  PERSON_DATA_CATEGORY,
  PERSON_FIELD_MAX,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  NATIONAL_ID_DATA_CATEGORY,
  PersonIdentityError,
  DataDictionaryError,
  MSG_ASOF_INVALID_FA,
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  actorHasCompensationRead,
  correctPersonnelCode,
  createPerson,
  getCurrentPersonState,
  getPersonById,
  getPersonByPersonnelCode,
  listDataElements,
  listEmploymentsForPerson,
  listEnabledProfileFields,
  matchReturn,
  mergePersons,
  projectPersonRecord,
  getEnabledPersonFieldKeys,
  splitPerson,
  updatePersonIdentity,
  type PersonProfileFieldKey,
} from "@divan/person-employment";
import { parseDateOnly, todayDateOnlyTehran } from "@divan/temporal-engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";
import {
  filterPriorEmployments,
  mapsToProfileOrgJobLabels,
} from "@/lib/person-profile-mapper";
import {
  assertPersonInScopedPopulation,
  resolveLabelsForStates,
  runPersonnelScopedSearch,
} from "./personnel-scoped-search";

const personReadMeta = {
  permission: PERSON_READ_PERMISSION,
  dataCategory: PERSON_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const personWriteMeta = {
  permission: PERSON_WRITE_PERMISSION,
  dataCategory: PERSON_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const nationalIdWriteMeta = {
  permission: PERSON_WRITE_PERMISSION,
  dataCategory: NATIONAL_ID_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: true as const,
};

let currentStatePool: Pool | null = null;

function getCurrentStatePool(): Pool {
  if (currentStatePool) return currentStatePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for current person state");
  }
  currentStatePool = getSharedPgPool(url);
  return currentStatePool;
}

function mapPersonError(err: unknown): never {
  if (err instanceof DataDictionaryError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof PersonIdentityError) {
    if (err.code === "PERSON_NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (
      err.code === "DUPLICATE_PERSONNEL_CODE" ||
      err.code === "DUPLICATE_NATIONAL_ID"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "BLOCKED_IDENTITY_OPERATION" || err.code === "PERMISSION_DENIED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "FIELD_NOT_ENABLED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err.messageFa,
        cause: err,
      });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "رکورد تکراری است.",
    });
  }
  throw err;
}

async function requirePersonRead(accountId: string): Promise<void> {
  try {
    await assertActorHasPersonRead(accountId);
  } catch (err) {
    mapPersonError(err);
  }
}

async function requirePersonWrite(accountId: string): Promise<void> {
  try {
    await assertActorHasPersonWrite(accountId);
  } catch (err) {
    mapPersonError(err);
  }
}

/** Ordinary identity category for demo reads — national_id omitted unless granted. */
const ORDINARY_ALLOWED = new Set([PERSON_DATA_CATEGORY]);

async function toPublicPerson(
  person: {
    id: string;
    personnelCode: string;
    givenName: string;
    familyName: string;
    mobilePhone: string;
    fatherName: string | null;
    birthDate: string | null;
    gender: string | null;
    nationality: string | null;
    nationalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  enabledFields?: ReadonlySet<PersonProfileFieldKey>,
) {
  const fields = enabledFields ?? (await getEnabledPersonFieldKeys());
  return projectPersonRecord(person, {
    enabledFields: fields,
    allowedCategories: ORDINARY_ALLOWED,
    categories: DEV_DEMO_CATEGORIES,
  });
}

const identityFieldsSchema = z.object({
  givenName: z.string().min(1).max(PERSON_FIELD_MAX.givenName),
  familyName: z.string().min(1).max(PERSON_FIELD_MAX.familyName),
  mobilePhone: z.string().min(1).max(PERSON_FIELD_MAX.mobilePhone),
  fatherName: z
    .string()
    .max(PERSON_FIELD_MAX.fatherName)
    .optional()
    .nullable(),
  birthDate: z.string().max(32).optional().nullable(),
  gender: z.string().max(PERSON_FIELD_MAX.gender).optional().nullable(),
  nationality: z
    .string()
    .max(PERSON_FIELD_MAX.nationality)
    .optional()
    .nullable(),
});

export const personRouter = createTRPCRouter({
  /**
   * Permission-safe personnel search/list (Story 5.1 / FR-33).
   * Do not use unscoped `list` as the FR33 source.
   */
  search: governedProcedure
    .meta({ ...personReadMeta, operation: "person.search" })
    .input(
      z
        .object({
          channel: z.enum(["search", "list"]).default("list"),
          normalizedQuery: z.string().max(200).optional(),
          /** Story 7.8 — 1-based page number. Defaults to 1. */
          page: z.number().int().min(1).optional(),
          /** Default 50, capped at 100 (enforced server-side too). */
          pageSize: z.number().int().min(1).max(100).optional(),
          /** Continuation token from a prior page===1 response. */
          evaluationSnapshotId: z.string().min(1).optional(),
          sortKey: z.string().max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        const result = await runPersonnelScopedSearch({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
          channel: input?.channel ?? "list",
          normalizedQuery: input?.normalizedQuery,
          page: input?.page,
          pageSize: input?.pageSize,
          evaluationSnapshotId: input?.evaluationSnapshotId,
          sortKey: input?.sortKey,
        });
        return {
          ...result,
          profileHrefPrefix: "/personnel/profile/",
        };
      } catch (err) {
        if (err instanceof EvaluationSnapshotError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.messageFa,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Legacy list — same PopulationPort scope as `person.search` (Story 5.1 review).
   * Prefer `person.search` for FR-33 list UI; this path must not dump unscoped Person rows.
   */
  list: governedProcedure
    .meta({ ...personReadMeta, operation: "person.list" })
    .query(async ({ ctx }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        const scoped = await runPersonnelScopedSearch({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
          channel: "list",
        });
        if (scoped.outcome !== "allowed" || scoped.rows.length === 0) {
          return [];
        }
        const enabledFields = await getEnabledPersonFieldKeys();
        const persons = await Promise.all(
          scoped.rows.map((r) => getPersonById(r.id)),
        );
        return Promise.all(
          persons
            .filter((p): p is NonNullable<typeof p> => p != null)
            .map((p) => toPublicPerson(p, enabledFields)),
        );
      } catch (err) {
        mapPersonError(err);
      }
    }),

  getById: governedProcedure
    .meta({ ...personReadMeta, operation: "person.get" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.id,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const person = await getPersonById(input.id);
        if (!person) {
          throw new PersonIdentityError(
            "PERSON_NOT_FOUND",
            "پرسنل یافت نشد.",
          );
        }
        return toPublicPerson(person);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /**
   * Shared Person state (Stories 4.9–4.10 / FR-25 / FR-26).
   * Optional asOf: date-only YYYY-MM-DD (Tehran). Future → planned semantics.
   * Assembler lives in @divan/person-employment; compensation omit inside module.
   */
  getCurrentState: governedProcedure
    .meta({ ...personReadMeta, operation: "person.current_state" })
    .input(
      z.object({
        personId: z.string().min(1),
        asOf: z
          .string()
          .min(1)
          .optional()
          .superRefine((val, ctx) => {
            if (val === undefined) return;
            const parsed = parseDateOnly(val);
            if (!parsed.ok) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: MSG_ASOF_INVALID_FA,
              });
            }
          }),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.personId,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const hasCompensationRead = await actorHasCompensationRead(
          ctx.session.accountId,
        );
        const allowedCategories = new Set<string>([PERSON_DATA_CATEGORY]);
        if (hasCompensationRead) {
          allowedCategories.add(COMPENSATION_DATA_CATEGORY);
        }
        return await getCurrentPersonState(
          input.personId,
          {
            asOf: input.asOf,
            actorAuthz: {
              allowedCategories,
              categories: DEV_DEMO_CATEGORIES,
              hasCompensationRead,
            },
          },
          { eventDb: getCurrentStatePool() },
        );
      } catch (err) {
        mapPersonError(err);
      }
    }),

  getByPersonnelCode: governedProcedure
    .meta({ ...personReadMeta, operation: "person.get_by_code" })
    .input(z.object({ personnelCode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        const person = await getPersonByPersonnelCode(input.personnelCode);
        if (!person) {
          throw new PersonIdentityError(
            "PERSON_NOT_FOUND",
            "پرسنل یافت نشد.",
          );
        }
        await assertPersonInScopedPopulation({
          personId: person.id,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        return toPublicPerson(person);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /** Enabled profile fields for thin render/edit (dictionary gate). */
  listEnabledFields: governedProcedure
    .meta({ ...personReadMeta, operation: "person.enabled_fields" })
    .query(async ({ ctx }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        return await listEnabledProfileFields({
          accountId: ctx.session.accountId,
        });
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /**
   * Prior (closed) employments for profile (Story 5.2 / FR-34).
   * Scoped + person.read — no parallel profile projection table.
   */
  listPriorEmployments: governedProcedure
    .meta({ ...personReadMeta, operation: "person.prior_employments" })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.personId,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const rows = await listEmploymentsForPerson(input.personId);
        return filterPriorEmployments(rows, todayDateOnlyTehran());
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /**
   * Org/job display labels for profile sections (Story 5.2).
   * Reuses list projector lookup path — not a new SoT.
   */
  getProfileLabels: governedProcedure
    .meta({ ...personReadMeta, operation: "person.profile_labels" })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.personId,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const hasCompensationRead = await actorHasCompensationRead(
          ctx.session.accountId,
        );
        const allowedCategories = new Set<string>([PERSON_DATA_CATEGORY]);
        if (hasCompensationRead) {
          allowedCategories.add(COMPENSATION_DATA_CATEGORY);
        }
        const state = await getCurrentPersonState(
          input.personId,
          {
            actorAuthz: {
              allowedCategories,
              categories: DEV_DEMO_CATEGORIES,
              hasCompensationRead,
            },
          },
          { eventDb: getCurrentStatePool() },
        );
        if (!state.ok) {
          return mapsToProfileOrgJobLabels({
            teamNameById: new Map(),
            roleNameById: new Map(),
            jobTitleNameById: new Map(),
            ladderNameById: new Map(),
            gradeNameById: new Map(),
            orgUnitNameById: new Map(),
          });
        }
        const labels = await resolveLabelsForStates([state]);
        return mapsToProfileOrgJobLabels(labels);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /** Thin admin registry read — disposition + enabled (not full governance UI). */
  listDictionary: governedProcedure
    .meta({ ...personReadMeta, operation: "person.dictionary.list" })
    .query(async ({ ctx }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        const rows = await listDataElements();
        return rows.map((r) => ({
          elementId: r.elementId,
          disposition: r.disposition,
          enabled: r.enabled,
          labelFa: r.labelFa,
          categoryId: r.categoryId,
          sensitivity: r.sensitivity,
          registryVersion: r.registryVersion,
        }));
      } catch (err) {
        mapPersonError(err);
      }
    }),

  create: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.create" })
    .input(
      identityFieldsSchema.extend({
        personnelCode: z
          .string()
          .min(1)
          .max(PERSON_FIELD_MAX.personnelCode),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        const person = await createPerson(input, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return toPublicPerson(person);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  updateIdentity: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.identity.update" })
    .input(
      z.object({
        id: z.string().min(1),
        givenName: z
          .string()
          .min(1)
          .max(PERSON_FIELD_MAX.givenName)
          .optional(),
        familyName: z
          .string()
          .min(1)
          .max(PERSON_FIELD_MAX.familyName)
          .optional(),
        mobilePhone: z
          .string()
          .min(1)
          .max(PERSON_FIELD_MAX.mobilePhone)
          .optional(),
        fatherName: z
          .string()
          .max(PERSON_FIELD_MAX.fatherName)
          .optional()
          .nullable(),
        birthDate: z.string().max(32).optional().nullable(),
        gender: z
          .string()
          .max(PERSON_FIELD_MAX.gender)
          .optional()
          .nullable(),
        nationality: z
          .string()
          .max(PERSON_FIELD_MAX.nationality)
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.id,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const { id, ...fields } = input;
        const person = await updatePersonIdentity(id, fields, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
        return toPublicPerson(person);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /**
   * National ID write — category gate first (`identity.national_id`).
   * Production hook stays disabled → fail closed unless explicit enablement.
   * Dictionary disposition approve ≠ production category enabled.
   */
  setNationalId: governedProcedure
    .meta({ ...nationalIdWriteMeta, operation: "person.national_id.write" })
    .input(
      z.object({
        id: z.string().min(1),
        nationalId: z
          .string()
          .max(PERSON_FIELD_MAX.nationalId)
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        await assertPersonInScopedPopulation({
          personId: input.id,
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        const person = await updatePersonIdentity(
          input.id,
          { nationalId: input.nationalId },
          {
            accountId: ctx.session.accountId,
            correlationId: ctx.correlationId,
          },
        );
        // Write grant ≠ read grant — do not echo nationalId.
        return toPublicPerson(person);
      } catch (err) {
        mapPersonError(err);
      }
    }),

  /** Deep-link blocked ops — surface fail-closed Persian explanation. */
  correctPersonnelCode: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.personnel_code.correct" })
    .input(
      z.object({
        personId: z.string().min(1),
        newCode: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        correctPersonnelCode(input.personId, input.newCode, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
      } catch (err) {
        mapPersonError(err);
      }
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MSG_BLOCKED_IDENTITY_OPERATION_FA,
      });
    }),

  mergePersons: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.merge" })
    .input(
      z.object({
        sourceId: z.string().min(1),
        targetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        mergePersons(input.sourceId, input.targetId, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
      } catch (err) {
        mapPersonError(err);
      }
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MSG_BLOCKED_IDENTITY_OPERATION_FA,
      });
    }),

  splitPerson: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.split" })
    .input(z.object({ personId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        splitPerson(input.personId, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
      } catch (err) {
        mapPersonError(err);
      }
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MSG_BLOCKED_IDENTITY_OPERATION_FA,
      });
    }),

  matchReturn: governedProcedure
    .meta({ ...personWriteMeta, operation: "person.return_match" })
    .input(z.object({ personId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requirePersonWrite(ctx.session.accountId);
      try {
        matchReturn(input.personId, {
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
        });
      } catch (err) {
        mapPersonError(err);
      }
      throw new TRPCError({
        code: "FORBIDDEN",
        message: MSG_BLOCKED_IDENTITY_OPERATION_FA,
      });
    }),
});

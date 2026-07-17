/**
 * Person identity + Data Dictionary governed router (Stories 3.1 / 3.3 / FR-5 / FR-7).
 * Coarse hr_admin / hr_operator unlock nav only — mutations require
 * `person.write` / `person.read` via PermissionSet + envelope.
 */
import {
  DEV_DEMO_CATEGORIES,
} from "@divan/audit-envelope";
import {
  PERSON_DATA_CATEGORY,
  PERSON_FIELD_MAX,
  PERSON_READ_PERMISSION,
  PERSON_WRITE_PERMISSION,
  NATIONAL_ID_DATA_CATEGORY,
  PersonIdentityError,
  DataDictionaryError,
  MSG_BLOCKED_IDENTITY_OPERATION_FA,
  assertActorHasPersonRead,
  assertActorHasPersonWrite,
  correctPersonnelCode,
  createPerson,
  getPersonById,
  getPersonByPersonnelCode,
  listDataElements,
  listEnabledProfileFields,
  listPersons,
  matchReturn,
  mergePersons,
  projectPersonRecord,
  getEnabledPersonFieldKeys,
  splitPerson,
  updatePersonIdentity,
  type PersonProfileFieldKey,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

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
  list: governedProcedure
    .meta({ ...personReadMeta, operation: "person.list" })
    .query(async ({ ctx }) => {
      await requirePersonRead(ctx.session.accountId);
      try {
        const rows = await listPersons();
        const enabledFields = await getEnabledPersonFieldKeys();
        return Promise.all(rows.map((p) => toPublicPerson(p, enabledFields)));
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

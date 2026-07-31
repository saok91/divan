/**
 * Job reference governed router (Story 3.6 / FR-10).
 * Coarse hr_admin unlocks /organization nav only — mutations require job_reference.write.
 * Separate from organization.* router — distinct meta/permissions.
 */
import {
  JOB_REFERENCE_DATA_CATEGORY,
  JOB_REFERENCE_READ_PERMISSION,
  JOB_REFERENCE_WRITE_PERMISSION,
  JobRefError,
  activateGrade,
  activateJobTitle,
  activateLadder,
  activateOrganizationalRole,
  activateSeniority,
  assertActorHasJobReferenceRead,
  assertActorHasJobReferenceWrite,
  createGrade,
  createJobTitle,
  createLadder,
  createOrganizationalRole,
  createSeniority,
  deactivateGrade,
  deactivateJobTitle,
  deactivateLadder,
  deactivateOrganizationalRole,
  deactivateSeniority,
  getGradeById,
  getJobTitleById,
  getLadderById,
  getOrganizationalRoleById,
  getSeniorityById,
  getGradeByCode,
  getJobTitleByCode,
  getLadderByCode,
  getOrganizationalRoleByCode,
  getSeniorityByCode,
  listGradesForLadder,
  listJobTitles,
  listLadders,
  listOrganizationalRoles,
  listSeniorities,
  updateGradeIdentity,
  updateJobTitleIdentity,
  updateLadderIdentity,
  updateOrganizationalRoleIdentity,
  updateSeniorityIdentity,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

const jobRefReadMeta = {
  permission: JOB_REFERENCE_READ_PERMISSION,
  dataCategory: JOB_REFERENCE_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const jobRefWriteMeta = {
  permission: JOB_REFERENCE_WRITE_PERMISSION,
  dataCategory: JOB_REFERENCE_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const createInputSchema = z.object({
  code: z.string().min(1),
  nameFa: z.string().min(1),
  startDate: z.string().min(1),
  endDateExclusive: z.string().nullable().optional(),
});

const deactivateInputSchema = z.object({
  id: z.string().min(1),
  endDateExclusive: z.string().min(1).nullable().optional(),
});

const identityInputSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1).optional(),
  nameFa: z.string().min(1).optional(),
});

function mapJobRefError(err: unknown): never {
  if (err instanceof JobRefError) {
    if (err.code === "JOB_REF_NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "DUPLICATE_JOB_REF_CODE") {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "DUPLICATE_JOB_REF_RANK") {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "PERMISSION_DENIED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
        cause: err,
      });
    }
    // Domain / validation / fail-closed operational blocks → BAD_REQUEST
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
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2003"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ارجاع نامعتبر است.",
    });
  }
  throw err;
}

function listOptsSchema() {
  return z
    .object({
      includeInactive: z.boolean().optional(),
    })
    .optional();
}

export const jobReferenceRouter = createTRPCRouter({
  listRoles: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.list_roles" })
    .input(listOptsSchema())
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        return await listOrganizationalRoles({
          includeInactive: input?.includeInactive === true,
        });
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  listJobTitles: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.list_job_titles" })
    .input(listOptsSchema())
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        return await listJobTitles({
          includeInactive: input?.includeInactive === true,
        });
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  listLadders: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.list_ladders" })
    .input(listOptsSchema())
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        return await listLadders({
          includeInactive: input?.includeInactive === true,
        });
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  listGradesForLadder: governedProcedure
    .meta({
      ...jobRefReadMeta,
      operation: "job_reference.list_grades_for_ladder",
    })
    .input(
      z.object({
        ladderId: z.string().min(1),
        includeInactive: z.boolean().optional(),
        asOf: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        return await listGradesForLadder(input.ladderId, {
          includeInactive: input.includeInactive === true,
          asOf: input.asOf,
        });
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  listSeniorities: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.list_seniorities" })
    .input(listOptsSchema())
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        return await listSeniorities({
          includeInactive: input?.includeInactive === true,
        });
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  getRole: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.get_role" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        const row = await getOrganizationalRoleById(input.id);
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  getJobTitle: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.get_job_title" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        const row = await getJobTitleById(input.id);
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  getLadder: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.get_ladder" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        const row = await getLadderById(input.id);
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  getGrade: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.get_grade" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        const row = await getGradeById(input.id);
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  getSeniority: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.get_seniority" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        const row = await getSeniorityById(input.id);
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return row;
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  /**
   * Resolve job-ref concept by business code (Story 8.3).
   * Grade requires ladderId — codes are unique per ladder only.
   */
  getByCode: governedProcedure
    .meta({ ...jobRefReadMeta, operation: "job_reference.getByCode" })
    .input(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("organizationalRole"),
          code: z.string().min(1),
        }),
        z.object({ kind: z.literal("jobTitle"), code: z.string().min(1) }),
        z.object({ kind: z.literal("ladder"), code: z.string().min(1) }),
        z.object({
          kind: z.literal("grade"),
          code: z.string().min(1),
          ladderId: z.string().min(1),
        }),
        z.object({ kind: z.literal("seniority"), code: z.string().min(1) }),
      ]),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasJobReferenceRead(ctx.session.accountId);
      try {
        let row = null;
        switch (input.kind) {
          case "organizationalRole":
            row = await getOrganizationalRoleByCode(input.code);
            break;
          case "jobTitle":
            row = await getJobTitleByCode(input.code);
            break;
          case "ladder":
            row = await getLadderByCode(input.code);
            break;
          case "grade":
            row = await getGradeByCode(input.ladderId, input.code);
            break;
          case "seniority":
            row = await getSeniorityByCode(input.code);
            break;
        }
        if (!row) {
          throw new JobRefError(
            "JOB_REF_NOT_FOUND",
            "مرجع شغلی یافت نشد.",
          );
        }
        return { kind: input.kind, ...row };
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  createRole: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.create_role" })
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await createOrganizationalRole(input);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  createJobTitle: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.create_job_title" })
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await createJobTitle(input);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  createLadder: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.create_ladder" })
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await createLadder(input);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  createGrade: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.create_grade" })
    .input(
      createInputSchema.extend({
        ladderId: z.string().min(1),
        rank: z.union([z.string(), z.number()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await createGrade(input);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  createSeniority: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.create_seniority" })
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await createSeniority(input);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  activateRole: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.activate_role" })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await activateOrganizationalRole(input.id);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  activateJobTitle: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.activate_job_title",
    })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await activateJobTitle(input.id);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  activateLadder: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.activate_ladder" })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await activateLadder(input.id);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  activateGrade: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.activate_grade" })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await activateGrade(input.id);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  activateSeniority: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.activate_seniority",
    })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await activateSeniority(input.id);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  deactivateRole: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.deactivate_role" })
    .input(deactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await deactivateOrganizationalRole(
          input.id,
          input.endDateExclusive,
        );
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  deactivateJobTitle: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.deactivate_job_title",
    })
    .input(deactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await deactivateJobTitle(input.id, input.endDateExclusive);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  deactivateLadder: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.deactivate_ladder" })
    .input(deactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await deactivateLadder(input.id, input.endDateExclusive);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  deactivateGrade: governedProcedure
    .meta({ ...jobRefWriteMeta, operation: "job_reference.deactivate_grade" })
    .input(deactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await deactivateGrade(input.id, input.endDateExclusive);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  deactivateSeniority: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.deactivate_seniority",
    })
    .input(deactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        return await deactivateSeniority(input.id, input.endDateExclusive);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  updateRoleIdentity: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.update_role_identity",
    })
    .input(identityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        const { id, ...rest } = input;
        return await updateOrganizationalRoleIdentity(id, rest);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  updateJobTitleIdentity: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.update_job_title_identity",
    })
    .input(identityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        const { id, ...rest } = input;
        return await updateJobTitleIdentity(id, rest);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  updateLadderIdentity: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.update_ladder_identity",
    })
    .input(identityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        const { id, ...rest } = input;
        return await updateLadderIdentity(id, rest);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  updateGradeIdentity: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.update_grade_identity",
    })
    .input(
      identityInputSchema.extend({
        rank: z.union([z.string(), z.number()]).optional(),
        ladderId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        const { id, ...rest } = input;
        return await updateGradeIdentity(id, rest);
      } catch (err) {
        mapJobRefError(err);
      }
    }),

  updateSeniorityIdentity: governedProcedure
    .meta({
      ...jobRefWriteMeta,
      operation: "job_reference.update_seniority_identity",
    })
    .input(identityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertActorHasJobReferenceWrite(ctx.session.accountId);
      try {
        const { id, ...rest } = input;
        return await updateSeniorityIdentity(id, rest);
      } catch (err) {
        mapJobRefError(err);
      }
    }),
});

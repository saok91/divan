/**
 * Organization hierarchy governed router (Story 3.5 / FR-9).
 * Coarse hr_admin unlocks nav only — mutations require organization.write.
 */
import {
  ORGANIZATION_DATA_CATEGORY,
  ORGANIZATION_READ_PERMISSION,
  ORGANIZATION_WRITE_PERMISSION,
  ORG_UNIT_TYPES,
  OrgUnitError,
  activateOrgUnit,
  assertActorHasOrganizationRead,
  assertActorHasOrganizationWrite,
  createOrgUnit,
  deactivateOrgUnit,
  getHierarchyAsOf,
  getOrgUnitById,
  listOrgUnits,
  updateOrgUnitIdentity,
  type OrgUnitType,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

const organizationReadMeta = {
  permission: ORGANIZATION_READ_PERMISSION,
  dataCategory: ORGANIZATION_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const organizationWriteMeta = {
  permission: ORGANIZATION_WRITE_PERMISSION,
  dataCategory: ORGANIZATION_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:selfcheck",
  sensitive: false as const,
};

const unitTypeSchema = z.enum(
  ORG_UNIT_TYPES as unknown as [OrgUnitType, ...OrgUnitType[]],
);

function mapOrgError(err: unknown): never {
  if (err instanceof OrgUnitError) {
    if (err.code === "ORG_UNIT_NOT_FOUND") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: err.messageFa,
        cause: err,
      });
    }
    if (err.code === "DUPLICATE_ORG_CODE") {
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
    // (DEACTIVATION_BLOCKED_DEPENDENCIES, BLOCKED_ORG_OPERATION, …) — not FORBIDDEN.
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
      message: "ارجاع والد نامعتبر است.",
    });
  }
  throw err;
}

export const organizationRouter = createTRPCRouter({
  list: governedProcedure
    .meta({ ...organizationReadMeta, operation: "organization.list" })
    .input(
      z
        .object({
          includeInactive: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await assertActorHasOrganizationRead(ctx.session.accountId);
      try {
        return await listOrgUnits({
          includeInactive: input?.includeInactive === true,
        });
      } catch (err) {
        mapOrgError(err);
      }
    }),

  get: governedProcedure
    .meta({ ...organizationReadMeta, operation: "organization.get" })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasOrganizationRead(ctx.session.accountId);
      try {
        const unit = await getOrgUnitById(input.id);
        if (!unit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "واحد سازمانی یافت نشد.",
          });
        }
        return unit;
      } catch (err) {
        mapOrgError(err);
      }
    }),

  hierarchyAsOf: governedProcedure
    .meta({
      ...organizationReadMeta,
      operation: "organization.hierarchyAsOf",
      allowClientTemporal: true,
    })
    .input(z.object({ asOfDate: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertActorHasOrganizationRead(ctx.session.accountId);
      try {
        return await getHierarchyAsOf(input.asOfDate);
      } catch (err) {
        mapOrgError(err);
      }
    }),

  create: governedProcedure
    .meta({ ...organizationWriteMeta, operation: "organization.create" })
    .input(
      z.object({
        code: z.string().min(1),
        nameFa: z.string().min(1),
        unitType: unitTypeSchema,
        parentId: z.string().nullable().optional(),
        startDate: z.string().min(1),
        endDateExclusive: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasOrganizationWrite(ctx.session.accountId);
      try {
        return await createOrgUnit({
          code: input.code,
          nameFa: input.nameFa,
          unitType: input.unitType,
          parentId: input.parentId,
          startDate: input.startDate,
          endDateExclusive: input.endDateExclusive,
        });
      } catch (err) {
        mapOrgError(err);
      }
    }),

  activate: governedProcedure
    .meta({ ...organizationWriteMeta, operation: "organization.activate" })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertActorHasOrganizationWrite(ctx.session.accountId);
      try {
        return await activateOrgUnit(input.id);
      } catch (err) {
        mapOrgError(err);
      }
    }),

  deactivate: governedProcedure
    .meta({ ...organizationWriteMeta, operation: "organization.deactivate" })
    .input(
      z.object({
        id: z.string().min(1),
        endDateExclusive: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasOrganizationWrite(ctx.session.accountId);
      try {
        return await deactivateOrgUnit(input.id, input.endDateExclusive);
      } catch (err) {
        mapOrgError(err);
      }
    }),

  updateIdentity: governedProcedure
    .meta({
      ...organizationWriteMeta,
      operation: "organization.updateIdentity",
    })
    .input(
      z.object({
        id: z.string().min(1),
        code: z.string().optional(),
        nameFa: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertActorHasOrganizationWrite(ctx.session.accountId);
      try {
        return await updateOrgUnitIdentity(input.id, {
          code: input.code,
          nameFa: input.nameFa,
        });
      } catch (err) {
        mapOrgError(err);
      }
    }),
});

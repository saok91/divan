/**
 * Access-administration governed router (Story 2.3 / FR-4).
 * Coarse hr_admin unlocks nav only — mutations require envelope
 * permission `access.administration` **and** an assigned PermissionSet
 * that includes that code.
 */
import {
  ACCESS_ADMINISTRATION_PERMISSION,
  ACCESS_ADMIN_DATA_CATEGORY,
  AccessAdminError,
  assertActorHasAccessAdministration,
  assignAccountAccessRoles,
  assignAccountScopes,
  createAccessRole,
  createOrganizationalScope,
  createPermissionSet,
  getAccountLink,
  getIdentityDb,
  listAccessRoles,
  listEntitlements,
  listOrganizationalScopes,
  listPermissionSets,
  previewApproveGrant,
  setAccountActiveStatus,
  updateAccessRole,
  updateAccountLink,
  updateOrganizationalScope,
  updatePermissionSet,
  type MutateResult,
} from "@divan/identity-access";
import { createPgPool } from "@divan/db";
import { appendAccessEvent } from "@divan/event-store";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, governedProcedure } from "./trpc";

const adminReadMeta = {
  permission: ACCESS_ADMINISTRATION_PERMISSION,
  dataCategory: ACCESS_ADMIN_DATA_CATEGORY,
  action: "read" as const,
  organizationalScope: "org:any",
  sensitive: true as const,
};

const adminWriteMeta = {
  permission: ACCESS_ADMINISTRATION_PERMISSION,
  dataCategory: ACCESS_ADMIN_DATA_CATEGORY,
  action: "write" as const,
  organizationalScope: "org:any",
  sensitive: true as const,
};

function mapAdminError(err: unknown): never {
  if (err instanceof AccessAdminError) {
    if (err.code === "TOXIC_COMBINATION") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.messageFa,
      });
    }
    if (err.code === "NOT_FOUND") {
      throw new TRPCError({ code: "NOT_FOUND", message: err.messageFa });
    }
    if (err.code === "CONFLICT") {
      throw new TRPCError({ code: "CONFLICT", message: err.messageFa });
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err.messageFa,
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

let evidencePool: ReturnType<typeof createPgPool> | null = null;

function getEvidencePool() {
  if (evidencePool) return evidencePool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "دسترسی ندارید.",
    });
  }
  evidencePool = createPgPool(url);
  return evidencePool;
}

async function recordMutationEvidence(input: {
  correlationId: string;
  actorAccountId: string;
  operation: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  decisionId: string;
}): Promise<void> {
  const pool = getEvidencePool();
  await appendAccessEvent(pool, {
    correlationId: input.correlationId,
    actorAccountId: input.actorAccountId,
    operation: input.operation,
    scope: {
      permission: ACCESS_ADMINISTRATION_PERMISSION,
      dataCategory: ACCESS_ADMIN_DATA_CATEGORY,
      action: "write",
      organizationalScope: "org:any",
      parentDecisionId: input.decisionId,
    },
    result: "allow",
    reason: "access_admin_mutation_detail",
    payload: {
      before: input.before,
      after: input.after,
    },
  });
}

/**
 * Mutate then append before/after evidence. If evidence fails, best-effort
 * compensate and fail the request (FR-51 / AC #1).
 */
async function mutateWithEvidence<T>(input: {
  accountId: string;
  correlationId: string;
  decisionId: string;
  operation: string;
  mutate: () => Promise<MutateResult<T>>;
  compensate: (result: MutateResult<T>) => Promise<void>;
}): Promise<T> {
  await assertActorHasAccessAdministration(input.accountId);
  const result = await input.mutate();
  try {
    await recordMutationEvidence({
      correlationId: input.correlationId,
      actorAccountId: input.accountId,
      operation: input.operation,
      before: result.before,
      after: result.after,
      decisionId: input.decisionId,
    });
  } catch (err) {
    try {
      await input.compensate(result);
    } catch (compensateErr) {
      console.error(
        "[access-admin] evidence append failed; compensate also failed",
        err,
        compensateErr,
      );
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "ثبت شواهد دسترسی ممکن نشد.",
    });
  }
  return result.entity;
}

async function requireAdminBinding(accountId: string): Promise<void> {
  try {
    await assertActorHasAccessAdministration(accountId);
  } catch (err) {
    mapAdminError(err);
  }
}

export const accessAdminRouter = createTRPCRouter({
  listEntitlements: governedProcedure
    .meta({
      ...adminReadMeta,
      operation: "access.entitlements.list",
    })
    .query(async ({ ctx }) => {
      await requireAdminBinding(ctx.session.accountId);
      return listEntitlements();
    }),

  listScopes: governedProcedure
    .meta({
      ...adminReadMeta,
      operation: "access.scope.list",
    })
    .query(async ({ ctx }) => {
      await requireAdminBinding(ctx.session.accountId);
      return listOrganizationalScopes();
    }),

  listPermissionSets: governedProcedure
    .meta({
      ...adminReadMeta,
      operation: "access.permission_set.list",
    })
    .query(async ({ ctx }) => {
      await requireAdminBinding(ctx.session.accountId);
      return listPermissionSets();
    }),

  listRoles: governedProcedure
    .meta({
      ...adminReadMeta,
      operation: "access.role.list",
    })
    .query(async ({ ctx }) => {
      await requireAdminBinding(ctx.session.accountId);
      return listAccessRoles();
    }),

  createScope: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.scope.create",
    })
    .input(z.object({ labelFa: z.string().min(1), active: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.scope.create",
          mutate: () =>
            createOrganizationalScope(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const id = result.after.id as string;
            await getIdentityDb().organizationalScope.delete({ where: { id } });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  updateScope: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.scope.update",
    })
    .input(
      z.object({
        id: z.string().min(1),
        labelFa: z.string().min(1).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.scope.update",
          mutate: () =>
            updateOrganizationalScope(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const before = result.before;
            if (!before) return;
            await getIdentityDb().organizationalScope.update({
              where: { id: input.id },
              data: {
                labelFa: before.labelFa as string,
                active: before.active as boolean,
              },
            });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  createPermissionSet: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.permission_set.create",
    })
    .input(
      z.object({
        name: z.string().min(1),
        permissions: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.permission_set.create",
          mutate: () =>
            createPermissionSet(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            await getIdentityDb().permissionSet.delete({
              where: { id: result.after.id as string },
            });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  updatePermissionSet: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.permission_set.update",
    })
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        permissions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.permission_set.update",
          mutate: () =>
            updatePermissionSet(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const before = result.before;
            if (!before) return;
            await getIdentityDb().permissionSet.update({
              where: { id: input.id },
              data: {
                name: before.name as string,
                permissions: before.permissions as string[],
              },
            });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  createRole: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.role.create",
    })
    .input(
      z.object({
        code: z.string().min(1),
        labelFa: z.string().min(1),
        permissionSetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.role.create",
          mutate: () =>
            createAccessRole(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            await getIdentityDb().accessRole.delete({
              where: { id: result.after.id as string },
            });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  updateRole: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.role.update",
    })
    .input(
      z.object({
        id: z.string().min(1),
        code: z.string().min(1).optional(),
        labelFa: z.string().min(1).optional(),
        permissionSetId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.role.update",
          mutate: () =>
            updateAccessRole(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const before = result.before;
            if (!before) return;
            await getIdentityDb().accessRole.update({
              where: { id: input.id },
              data: {
                code: before.code as string,
                labelFa: before.labelFa as string,
                permissionSetId: before.permissionSetId as string,
              },
            });
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  assignAccountRoles: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.role.assign",
    })
    .input(
      z.object({
        accountId: z.string().min(1),
        accessRoleIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.role.assign",
          mutate: () =>
            assignAccountAccessRoles(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const beforeIds = (result.before?.accessRoleIds as string[]) ?? [];
            await assignAccountAccessRoles(
              { accountId: input.accountId, accessRoleIds: beforeIds },
              {
                accountId: "compensate",
                correlationId: ctx.correlationId,
              },
            );
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  assignAccountScopes: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.scope.assign",
    })
    .input(
      z.object({
        accountId: z.string().min(1),
        organizationalScopeIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.scope.assign",
          mutate: () =>
            assignAccountScopes(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const beforeIds =
              (result.before?.organizationalScopeIds as string[]) ?? [];
            await assignAccountScopes(
              {
                accountId: input.accountId,
                organizationalScopeIds: beforeIds,
              },
              {
                accountId: "compensate",
                correlationId: ctx.correlationId,
              },
            );
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  getAccountLink: governedProcedure
    .meta({
      ...adminReadMeta,
      operation: "access.account.link.get",
    })
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        await requireAdminBinding(ctx.session.accountId);
        return await getAccountLink(input.accountId);
      } catch (err) {
        mapAdminError(err);
      }
    }),

  updateAccountLink: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.account.link",
    })
    .input(
      z.object({
        accountId: z.string().min(1),
        externalDirectoryId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.account.link",
          mutate: () =>
            updateAccountLink(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const beforeId =
              (result.before?.externalDirectoryId as string | null | undefined) ??
              null;
            await updateAccountLink(
              { accountId: input.accountId, externalDirectoryId: beforeId },
              {
                accountId: "compensate",
                correlationId: ctx.correlationId,
              },
            );
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  setAccountStatus: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.account.status",
    })
    .input(
      z.object({
        accountId: z.string().min(1),
        status: z.enum(["active", "inactive"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await mutateWithEvidence({
          accountId: ctx.session.accountId,
          correlationId: ctx.correlationId,
          decisionId: ctx.decisionId,
          operation: "access.account.status",
          mutate: () =>
            setAccountActiveStatus(input, {
              accountId: ctx.session.accountId,
              correlationId: ctx.correlationId,
            }),
          compensate: async (result) => {
            const beforeStatus = result.before?.status as
              | "active"
              | "inactive"
              | undefined;
            if (!beforeStatus) return;
            await setAccountActiveStatus(
              { accountId: input.accountId, status: beforeStatus },
              {
                accountId: "compensate",
                correlationId: ctx.correlationId,
              },
            );
          },
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),

  /**
   * Stub approve-grant preview — toxic fail-closed for Story 2.4 lifecycle.
   * Not a full entitlement approval API.
   */
  previewApproveGrant: governedProcedure
    .meta({
      ...adminWriteMeta,
      operation: "access.grant.approve.preview",
    })
    .input(
      z.object({
        subjectAccountId: z.string().min(1),
        grantId: z.string().min(1),
        combinesPermissionAdminWithSameGrantApproval: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await requireAdminBinding(ctx.session.accountId);
        return previewApproveGrant({
          actorAccountId: ctx.session.accountId,
          subjectAccountId: input.subjectAccountId,
          grantId: input.grantId,
          combinesPermissionAdminWithSameGrantApproval:
            input.combinesPermissionAdminWithSameGrantApproval,
        });
      } catch (err) {
        mapAdminError(err);
      }
    }),
});

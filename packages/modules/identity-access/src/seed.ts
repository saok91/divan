import type { PrismaClient } from "@divan/db";
import bcrypt from "bcryptjs";

import { seedCompensationFactsFixtures } from "@divan/compensation-facts";
import {
  seedEmploymentLifecycleFixtures,
  seedJobReferenceFixtures,
  seedManagementRelationshipFixtures,
  seedOrganizationHierarchyFixtures,
  seedPrimaryAssignmentFixtures,
  seedSecondaryAssignmentFixtures,
} from "@divan/person-employment";
import { seedAccessAdministrationFixtures } from "./access-admin";
import { seedBreakGlassFixtures } from "./break-glass";
import { getIdentityProvider } from "./config";
import { seedExportPermissionFixtures } from "./seed-export";
import { seedAuditPermissionFixtures } from "./seed-audit";
import { seedOpsPermissionFixtures } from "./seed-ops";
import { seedRetentionPermissionFixtures } from "./seed-retention";
import { seedAuditTrustPermissionFixtures } from "./seed-audit-trust";
import { seedCorrectionCasePermissionFixtures } from "./seed-correction-case";
import { seedPublicationPermissionFixtures } from "./seed-publication";
import type { CoarseRole } from "./types";

/** Shared local/dev/CI password — documented in README; never for production. */
export const DEV_SEED_PASSWORD = "DivanDev1!";

export type SeedAccountSpec = {
  username: string;
  coarseRole: CoarseRole;
  displayName: string;
};

export const SEED_ACCOUNTS: readonly SeedAccountSpec[] = [
  {
    username: "hr.operator",
    coarseRole: "hr_operator",
    displayName: "کارشناس منابع انسانی",
  },
  {
    username: "hr.admin",
    coarseRole: "hr_admin",
    displayName: "ادمین منابع انسانی",
  },
  {
    username: "manager",
    coarseRole: "manager",
    displayName: "مدیر",
  },
  {
    username: "audit.reviewer",
    coarseRole: "audit_reviewer",
    displayName: "بازبین ممیزی",
  },
  {
    username: "sys.admin",
    coarseRole: "system_admin",
    displayName: "ادمین سیستم",
  },
] as const;

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedGuardError";
  }
}

/**
 * Refuse seed unless explicitly allowed and not production.
 * Prefer both NODE_ENV !== production AND ALLOW_DEV_SEED=true.
 */
export function assertSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === "production") {
    throw new SeedGuardError(
      "Dev seed refuses to run when NODE_ENV=production",
    );
  }
  if (env.ALLOW_DEV_SEED !== "true") {
    throw new SeedGuardError(
      "Dev seed requires ALLOW_DEV_SEED=true (local/dev/CI only)",
    );
  }
  // LDAP mode must not gain a routine seeded login bypass via seed rows.
  if (getIdentityProvider(env) === "ldap") {
    throw new SeedGuardError(
      "Dev seed refuses when IDENTITY_PROVIDER=ldap — use directory accounts only",
    );
  }
}

/**
 * Upsert exactly five seeded accounts — one per MVP coarse role,
 * each linked to exactly one human identity (no shared accounts).
 * Module-owned; invoked from packages/db seed script.
 * Preserves account status on update so inactive fail-closed tests survive re-seed.
 */
export async function seedDevAccounts(db: PrismaClient): Promise<{
  createdOrUpdated: number;
}> {
  assertSeedAllowed();

  const passwordHash = await bcrypt.hash(DEV_SEED_PASSWORD, 10);

  return db.$transaction(async (tx) => {
    let createdOrUpdated = 0;

    for (const spec of SEED_ACCOUNTS) {
      const existing = await tx.internalAccount.findUnique({
        where: { username: spec.username },
        include: { humanIdentity: true },
      });

      if (existing) {
        // Reclaim LDAP-linked seed usernames: clear directory link and restore
        // local hash so seeded provider cannot keep a dual-path row.
        await tx.internalAccount.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            externalDirectoryId: null,
            coarseRole: spec.coarseRole,
            humanIdentity: {
              update: { displayName: spec.displayName },
            },
          },
        });
      } else {
        await tx.humanIdentity.create({
          data: {
            displayName: spec.displayName,
            account: {
              create: {
                username: spec.username,
                passwordHash,
                status: "active",
                coarseRole: spec.coarseRole,
              },
            },
          },
        });
      }
      createdOrUpdated += 1;
    }

    const count = await tx.internalAccount.count();
    if (count !== SEED_ACCOUNTS.length) {
      throw new SeedGuardError(
        `Expected exactly ${SEED_ACCOUNTS.length} seeded accounts, found ${count}. Remove extra accounts before re-seeding.`,
      );
    }

    await seedAccessAdministrationFixtures(tx as unknown as PrismaClient);
    await seedBreakGlassFixtures(tx as unknown as PrismaClient);
    await seedEmploymentLifecycleFixtures(tx as unknown as PrismaClient);
    await seedOrganizationHierarchyFixtures(tx as unknown as PrismaClient);
    await seedJobReferenceFixtures(tx as unknown as PrismaClient);
    await seedPrimaryAssignmentFixtures(tx as unknown as PrismaClient);
    await seedSecondaryAssignmentFixtures(tx as unknown as PrismaClient);
    await seedManagementRelationshipFixtures(tx as unknown as PrismaClient);
    await seedCompensationFactsFixtures(tx as unknown as PrismaClient);
    await seedExportPermissionFixtures(tx as unknown as PrismaClient);
    await seedAuditPermissionFixtures(tx as unknown as PrismaClient);
    await seedOpsPermissionFixtures(tx as unknown as PrismaClient);
    await seedRetentionPermissionFixtures(tx as unknown as PrismaClient);
    await seedAuditTrustPermissionFixtures(tx as unknown as PrismaClient);
    await seedCorrectionCasePermissionFixtures(tx as unknown as PrismaClient);
    await seedPublicationPermissionFixtures(tx as unknown as PrismaClient);

    return { createdOrUpdated };
  });
}

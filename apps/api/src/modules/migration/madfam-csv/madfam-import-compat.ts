/**
 * Production continuity helpers for MADFAM CSV import.
 *
 * Existing data at app.dhan.am (operator account + madfam-csv-* accounts) must
 * be reused on re-import — never duplicated because env names drifted.
 */
import type { PrismaClient } from '../../../../generated/prisma';

import type { MadfamCsvRoutingConfig, SpaceRole } from './madfam-csv-config';
import { loadMadfamCsvRoutingConfig } from './madfam-csv-config';

export const MADFAM_CSV_IMPORT_ORIGIN = 'madfam-csv-import';

export interface MadfamImportSpaceDef {
  role: SpaceRole;
  key: string;
  name: string;
  spaceId: string;
  type: 'personal' | 'business';
}

const PARTNER_ACCOUNT_SUFFIXES = ['-afac', '-partner'] as const;

function inferRoleFromProviderAccountId(providerAccountId: string): SpaceRole | null {
  if (!providerAccountId.startsWith('madfam-csv-')) return null;
  if (providerAccountId.endsWith('-personal')) return 'personal';
  if (PARTNER_ACCOUNT_SUFFIXES.some((suffix) => providerAccountId.endsWith(suffix))) {
    return 'partner';
  }
  // Business entity uses unsuffixed BBVA Empresarial id (and other no-suffix ids).
  return 'business';
}

function spaceRoleEnvKey(role: SpaceRole): string {
  return `MADFAM_SPACE_NAME_${role.toUpperCase()}` as const;
}

function envSpaceNameForRole(role: SpaceRole): string | undefined {
  return process.env[spaceRoleEnvKey(role)]?.trim() || undefined;
}

async function resolveSpaceForRoleFromEnv(
  prisma: PrismaClient,
  userId: string,
  role: SpaceRole
): Promise<{ spaceId: string; name: string; type: string } | null> {
  const envName = envSpaceNameForRole(role);
  if (!envName) return null;

  const userSpace = await prisma.userSpace.findFirst({
    where: { userId, space: { name: envName } },
    include: { space: true },
  });
  if (!userSpace) return null;

  return {
    spaceId: userSpace.space.id,
    name: userSpace.space.name,
    type: userSpace.space.type,
  };
}

/**
 * Discover space bindings from existing madfam-csv import rows for a user.
 * Missing roles (common: personal with no import accounts yet) can be filled
 * from MADFAM_SPACE_NAME_* env vars pointing at existing prod spaces.
 */
export async function discoverMadfamImportSpaces(
  prisma: PrismaClient,
  userId: string,
  routingConfig: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): Promise<MadfamImportSpaceDef[] | null> {
  const userSpaces = await prisma.userSpace.findMany({
    where: { userId },
    include: {
      space: {
        include: {
          accounts: {
            where: { providerAccountId: { startsWith: 'madfam-csv-' } },
            select: { providerAccountId: true },
          },
        },
      },
    },
  });

  const roleToSpace = new Map<SpaceRole, { spaceId: string; name: string; type: string }>();

  for (const { space } of userSpaces) {
    for (const account of space.accounts) {
      const role = inferRoleFromProviderAccountId(account.providerAccountId ?? '');
      if (!role) continue;

      const existing = roleToSpace.get(role);
      if (existing && existing.spaceId !== space.id) {
        return null;
      }
      roleToSpace.set(role, {
        spaceId: space.id,
        name: space.name,
        type: space.type,
      });
    }
  }

  const roles: SpaceRole[] = ['business', 'partner', 'personal'];
  for (const role of roles) {
    if (roleToSpace.has(role)) continue;
    const fromEnv = await resolveSpaceForRoleFromEnv(prisma, userId, role);
    if (fromEnv) {
      roleToSpace.set(role, fromEnv);
    }
  }

  if (roles.some((role) => !roleToSpace.has(role))) {
    return null;
  }

  return roles.map((role) => {
    const space = roleToSpace.get(role)!;
    return {
      role,
      key: routingConfig.spaceKeys[role],
      name: space.name,
      spaceId: space.spaceId,
      type: space.type === 'personal' ? 'personal' : 'business',
    };
  });
}

export interface MadfamImportCompatReport {
  ok: boolean;
  targetEmail: string;
  userId?: string;
  issues: string[];
  spaces: Array<{ role: SpaceRole; name: string; spaceId: string; accountCount: number }>;
  sampleProviderAccountIds: string[];
  budgets?: Array<{
    role: SpaceRole;
    spaceId: string;
    budgetId: string;
    hasImportMetadata: boolean;
  }>;
}

export interface MadfamBudgetMetadataBackfillResult {
  updated: number;
  skipped: number;
  details: Array<{
    role: SpaceRole;
    spaceId: string;
    budgetId: string;
    action: 'updated' | 'skipped';
  }>;
}

function budgetNameForSpace(spaceName: string): string {
  return `${spaceName} — Presupuesto`;
}

function budgetHasImportMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  return meta.origin === MADFAM_CSV_IMPORT_ORIGIN && typeof meta.spaceRole === 'string';
}

/**
 * Idempotently backfill madfam-csv-import budget metadata on prod spaces.
 */
export async function backfillMadfamBudgetMetadata(
  prisma: PrismaClient,
  userId: string,
  routingConfig: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig(),
  dryRun = false
): Promise<MadfamBudgetMetadataBackfillResult> {
  const result: MadfamBudgetMetadataBackfillResult = {
    updated: 0,
    skipped: 0,
    details: [],
  };

  const discovered = await discoverMadfamImportSpaces(prisma, userId, routingConfig);
  if (!discovered) {
    throw new Error(
      'Cannot backfill budget metadata: madfam import spaces not fully resolved. ' +
        'Set MADFAM_SPACE_NAME_* or ensure madfam-csv accounts exist.'
    );
  }

  for (const space of discovered) {
    let budget = await prisma.budget.findFirst({
      where: {
        spaceId: space.spaceId,
        metadata: { path: ['origin'], equals: MADFAM_CSV_IMPORT_ORIGIN },
      },
    });

    if (!budget) {
      budget = await prisma.budget.findFirst({
        where: { spaceId: space.spaceId, name: budgetNameForSpace(space.name) },
      });
    }

    if (!budget) {
      budget = await prisma.budget.findFirst({
        where: { spaceId: space.spaceId },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!budget) {
      result.skipped++;
      result.details.push({
        role: space.role,
        spaceId: space.spaceId,
        budgetId: 'none',
        action: 'skipped',
      });
      continue;
    }

    if (budgetHasImportMetadata(budget.metadata)) {
      result.skipped++;
      result.details.push({
        role: space.role,
        spaceId: space.spaceId,
        budgetId: budget.id,
        action: 'skipped',
      });
      continue;
    }

    const existingMeta =
      budget.metadata && typeof budget.metadata === 'object'
        ? (budget.metadata as Record<string, unknown>)
        : {};

    if (!dryRun) {
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          metadata: {
            ...existingMeta,
            origin: MADFAM_CSV_IMPORT_ORIGIN,
            spaceRole: space.role,
            metadataBackfilledAt: new Date().toISOString(),
          },
        },
      });
    }

    result.updated++;
    result.details.push({
      role: space.role,
      spaceId: space.spaceId,
      budgetId: budget.id,
      action: 'updated',
    });
  }

  return result;
}

async function checkBudgetMetadataForSpaces(
  prisma: PrismaClient,
  discovered: MadfamImportSpaceDef[]
): Promise<
  Array<{ role: SpaceRole; spaceId: string; budgetId: string; hasImportMetadata: boolean }>
> {
  const budgets: Array<{
    role: SpaceRole;
    spaceId: string;
    budgetId: string;
    hasImportMetadata: boolean;
  }> = [];

  for (const space of discovered) {
    let budget = await prisma.budget.findFirst({
      where: {
        spaceId: space.spaceId,
        metadata: { path: ['origin'], equals: MADFAM_CSV_IMPORT_ORIGIN },
      },
    });

    if (!budget) {
      budget = await prisma.budget.findFirst({
        where: { spaceId: space.spaceId, name: budgetNameForSpace(space.name) },
      });
    }

    if (!budget) {
      budgets.push({
        role: space.role,
        spaceId: space.spaceId,
        budgetId: 'none',
        hasImportMetadata: false,
      });
      continue;
    }

    budgets.push({
      role: space.role,
      spaceId: space.spaceId,
      budgetId: budget.id,
      hasImportMetadata: budgetHasImportMetadata(budget.metadata),
    });
  }

  return budgets;
}

/**
 * Preflight check before running import against production (or any DB).
 */
export async function verifyMadfamImportCompat(
  prisma: PrismaClient,
  targetEmail: string,
  routingConfig: MadfamCsvRoutingConfig = loadMadfamCsvRoutingConfig()
): Promise<MadfamImportCompatReport> {
  const issues: string[] = [];
  const report: MadfamImportCompatReport = {
    ok: false,
    targetEmail,
    issues,
    spaces: [],
    sampleProviderAccountIds: [],
  };

  if (!routingConfig.businessRfc) {
    issues.push('MADFAM_BUSINESS_RFC is not set');
  }

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    issues.push(`User not found: ${targetEmail}`);
    return report;
  }
  report.userId = user.id;

  const hasEnvSpaceNames =
    Boolean(process.env.MADFAM_SPACE_NAME_BUSINESS?.trim()) &&
    Boolean(process.env.MADFAM_SPACE_NAME_PARTNER?.trim()) &&
    Boolean(process.env.MADFAM_SPACE_NAME_PERSONAL?.trim());

  const discovered = await discoverMadfamImportSpaces(prisma, user.id, routingConfig);

  if (!discovered && !hasEnvSpaceNames) {
    issues.push(
      'No existing madfam-csv import accounts found and MADFAM_SPACE_NAME_* not set. ' +
        'For first import, set space display names. For prod re-import, set TARGET_USER_EMAIL to the operator account with existing data.'
    );
  }

  if (discovered) {
    for (const space of discovered) {
      const accountCount = await prisma.account.count({
        where: { spaceId: space.spaceId, providerAccountId: { startsWith: 'madfam-csv-' } },
      });
      report.spaces.push({
        role: space.role,
        name: space.name,
        spaceId: space.spaceId,
        accountCount,
      });
    }

    report.budgets = await checkBudgetMetadataForSpaces(prisma, discovered);
    for (const budget of report.budgets) {
      if (!budget.hasImportMetadata) {
        issues.push(
          `Budget metadata missing for ${budget.role} space (budget ${budget.budgetId}): ` +
            'expected metadata.origin=madfam-csv-import and spaceRole'
        );
      }
    }
  } else if (hasEnvSpaceNames) {
    issues.push(
      'INFO: Using MADFAM_SPACE_NAME_* from env (first import or explicit names). Existing madfam-csv accounts not required.'
    );
  }

  const sampleAccounts = await prisma.account.findMany({
    where: {
      providerAccountId: { startsWith: 'madfam-csv-' },
      space: { userSpaces: { some: { userId: user.id } } },
    },
    select: { providerAccountId: true },
    take: 8,
  });
  report.sampleProviderAccountIds = sampleAccounts.map((a) => a.providerAccountId ?? '');

  const partnerSuffix = routingConfig.accountSuffixes.partner;
  const hasLegacyAfac = report.sampleProviderAccountIds.some((id) => id.endsWith('-afac'));
  if (hasLegacyAfac && partnerSuffix !== '-afac') {
    issues.push(
      `Existing prod accounts use "-afac" suffix but MADFAM_ACCOUNT_SUFFIX_PARTNER=${partnerSuffix}. ` +
        'Leave unset or set to -afac to preserve idempotency.'
    );
  }

  // INFO lines are not failures
  report.ok = issues.every((issue) => issue.startsWith('INFO:'));
  return report;
}

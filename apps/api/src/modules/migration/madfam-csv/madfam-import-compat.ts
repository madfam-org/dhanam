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

/**
 * Discover space bindings from existing madfam-csv import rows for a user.
 * Used when operator env space names are unset but prod already has data.
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
      const role = inferRoleFromProviderAccountId(account.providerAccountId);
      if (!role) continue;

      const existing = roleToSpace.get(role);
      if (existing && existing.spaceId !== space.id) {
        // Ambiguous: two spaces claim the same role — require explicit env names.
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
  report.sampleProviderAccountIds = sampleAccounts.map((a) => a.providerAccountId);

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

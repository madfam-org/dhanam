/**
 * Hydrate MADFAM CSV import env vars from platform_config when PLATFORM_CONFIG_SOURCE=db.
 * Env vars always win — supports break-glass overrides without mutating DB.
 */
import type { PrismaClient } from '../../../../generated/prisma';
import { PlatformConfigScope } from '../../../../generated/prisma';
import {
  MADFAM_IMPORT_CONFIG_KEYS,
  MADFAM_IMPORT_ENV_MAP,
  jsonConfigToString,
  type MadfamImportConfigKey,
} from '../../platform-config/platform-config.keys';

export async function hydrateMadfamImportEnvFromPlatformConfig(
  prisma: Pick<PrismaClient, 'platformConfig'>
): Promise<number> {
  if (process.env.PLATFORM_CONFIG_SOURCE !== 'db') {
    return 0;
  }

  const keys = Object.values(MADFAM_IMPORT_CONFIG_KEYS);
  const rows = await prisma.platformConfig.findMany({
    where: {
      scope: PlatformConfigScope.platform,
      scopeId: '',
      key: { in: keys },
    },
  });

  let hydrated = 0;
  for (const row of rows) {
    const envKey = MADFAM_IMPORT_ENV_MAP[row.key as MadfamImportConfigKey];
    if (!envKey || process.env[envKey]?.trim()) continue;

    const str = jsonConfigToString(row.value);
    if (!str) continue;

    process.env[envKey] = str;
    hydrated++;
  }

  return hydrated;
}

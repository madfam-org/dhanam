import {
  MADFAM_IMPORT_CONFIG_KEYS,
  MADFAM_IMPORT_ENV_MAP,
  jsonConfigToString,
} from '../../../platform-config/platform-config.keys';
import { hydrateMadfamImportEnvFromPlatformConfig } from '../madfam-platform-config';

describe('madfam-platform-config', () => {
  const prisma = {
    platformConfig: {
      findMany: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    prisma.platformConfig.findMany.mockReset();
    delete process.env.PLATFORM_CONFIG_SOURCE;
    delete process.env.MADFAM_BUSINESS_RFC;
    delete process.env.MADFAM_SPACE_NAME_BUSINESS;
  });

  it('skips hydration when PLATFORM_CONFIG_SOURCE is not db', async () => {
    const count = await hydrateMadfamImportEnvFromPlatformConfig(prisma);
    expect(count).toBe(0);
    expect(prisma.platformConfig.findMany).not.toHaveBeenCalled();
  });

  it('hydrates env from platform_config without overriding existing env', async () => {
    process.env.PLATFORM_CONFIG_SOURCE = 'db';
    process.env.MADFAM_BUSINESS_RFC = 'EXISTING';

    prisma.platformConfig.findMany.mockResolvedValue([
      {
        key: MADFAM_IMPORT_CONFIG_KEYS.businessRfc,
        value: 'FROM-DB',
      },
      {
        key: MADFAM_IMPORT_CONFIG_KEYS.spaceNameBusiness,
        value: 'Innovaciones MADFAM',
      },
    ]);

    const count = await hydrateMadfamImportEnvFromPlatformConfig(prisma);
    expect(count).toBe(1);
    expect(process.env.MADFAM_BUSINESS_RFC).toBe('EXISTING');
    expect(process.env.MADFAM_SPACE_NAME_BUSINESS).toBe('Innovaciones MADFAM');
  });

  it('maps all madfam import keys to env vars', () => {
    expect(MADFAM_IMPORT_ENV_MAP[MADFAM_IMPORT_CONFIG_KEYS.businessRfc]).toBe(
      'MADFAM_BUSINESS_RFC'
    );
    expect(Object.keys(MADFAM_IMPORT_ENV_MAP)).toHaveLength(6);
  });

  it('jsonConfigToString accepts plain strings and { value } objects', () => {
    expect(jsonConfigToString(' RFC ')).toBe('RFC');
    expect(jsonConfigToString({ value: '-afac' })).toBe('-afac');
    expect(jsonConfigToString(null)).toBeNull();
  });
});

describe('jsonConfigToString edge cases', () => {
  it('coerces booleans and numbers', () => {
    expect(jsonConfigToString(true)).toBe('true');
    expect(jsonConfigToString(42)).toBe('42');
  });
});

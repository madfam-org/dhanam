import { SYNTHETIC_MADFAM_CSV_ROUTING, loadMadfamCsvRoutingConfig } from '../madfam-csv-config';
import { mapAccount } from '../madfam-csv-mapper';
import {
  discoverMadfamImportSpaces,
  MADFAM_CSV_IMPORT_ORIGIN,
  verifyMadfamImportCompat,
  type MadfamImportSpaceDef,
} from '../madfam-import-compat';

describe('madfam-import-compat', () => {
  describe('mapAccount production defaults', () => {
    it('uses -afac partner suffix by default (prod idempotency)', () => {
      const config = loadMadfamCsvRoutingConfig();
      expect(config.accountSuffixes.partner).toBe('-afac');

      const result = mapAccount('Banamex Joy Personal', 'partner', config);
      expect(result.providerAccountId).toBe('madfam-csv-banamex-joy-afac');
    });

    it('honours MADFAM_ACCOUNT_SUFFIX_PARTNER override', () => {
      const prev = process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER;
      process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER = '-partner';
      const config = loadMadfamCsvRoutingConfig();
      expect(mapAccount('Banamex Joy Personal', 'partner', config).providerAccountId).toBe(
        'madfam-csv-banamex-joy-partner'
      );
      if (prev === undefined) delete process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER;
      else process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER = prev;
    });
  });

  describe('discoverMadfamImportSpaces', () => {
    const prisma = {
      userSpace: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    } as any;

    beforeEach(() => {
      prisma.userSpace.findMany.mockReset();
      prisma.userSpace.findFirst.mockReset();
    });

    it('maps legacy -afac accounts to partner role', async () => {
      prisma.userSpace.findMany.mockResolvedValue([
        {
          space: {
            id: 'space-business',
            name: 'Business Co',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-bbva-empresarial' }],
          },
        },
        {
          space: {
            id: 'space-partner',
            name: 'Partner Co',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-banamex-joy-afac' }],
          },
        },
        {
          space: {
            id: 'space-personal',
            name: 'Personal',
            type: 'personal',
            accounts: [{ providerAccountId: 'madfam-csv-banamex-joy-personal' }],
          },
        },
      ]);

      const discovered = await discoverMadfamImportSpaces(
        prisma,
        'user-1',
        SYNTHETIC_MADFAM_CSV_ROUTING
      );
      expect(discovered).toHaveLength(3);
      expect(discovered!.find((s) => s.role === 'business')!.spaceId).toBe('space-business');
      expect(discovered!.find((s) => s.role === 'partner')!.spaceId).toBe('space-partner');
      expect(discovered!.find((s) => s.role === 'personal')!.spaceId).toBe('space-personal');
    });

    it('returns null when roles are ambiguous', async () => {
      prisma.userSpace.findMany.mockResolvedValue([
        {
          space: {
            id: 'space-a',
            name: 'A',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-banamex-joy-afac' }],
          },
        },
        {
          space: {
            id: 'space-b',
            name: 'B',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-bbva-azul-afac' }],
          },
        },
      ]);

      expect(
        await discoverMadfamImportSpaces(prisma, 'user-1', SYNTHETIC_MADFAM_CSV_ROUTING)
      ).toBeNull();
    });
    it('fills personal role from MADFAM_SPACE_NAME_PERSONAL when no -personal accounts', async () => {
      prisma.userSpace.findMany.mockResolvedValue([
        {
          space: {
            id: 'space-business',
            name: 'Business Co',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-bbva-empresarial' }],
          },
        },
        {
          space: {
            id: 'space-partner',
            name: 'Partner Co',
            type: 'business',
            accounts: [{ providerAccountId: 'madfam-csv-banamex-joy-afac' }],
          },
        },
      ]);

      const prev = process.env.MADFAM_SPACE_NAME_PERSONAL;
      process.env.MADFAM_SPACE_NAME_PERSONAL = 'Personal Space';
      prisma.userSpace.findFirst.mockResolvedValue({
        space: { id: 'space-personal', name: 'Personal Space', type: 'personal' },
      });

      const discovered = await discoverMadfamImportSpaces(
        prisma,
        'user-1',
        SYNTHETIC_MADFAM_CSV_ROUTING
      );
      expect(discovered).toHaveLength(3);
      expect(discovered!.find((s) => s.role === 'personal')!.spaceId).toBe('space-personal');

      if (prev === undefined) delete process.env.MADFAM_SPACE_NAME_PERSONAL;
      else process.env.MADFAM_SPACE_NAME_PERSONAL = prev;
    });
  });
});

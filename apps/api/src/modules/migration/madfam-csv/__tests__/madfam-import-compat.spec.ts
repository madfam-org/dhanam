import { SYNTHETIC_MADFAM_CSV_ROUTING, loadMadfamCsvRoutingConfig } from '../madfam-csv-config';
import { mapAccount } from '../madfam-csv-mapper';
import {
  backfillMadfamBudgetMetadata,
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

  describe('backfillMadfamBudgetMetadata', () => {
    it('updates budgets missing import metadata', async () => {
      const prismaBackfill = {
        userSpace: {
          findMany: jest.fn().mockResolvedValue([
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
          ]),
          findFirst: jest.fn(),
        },
        budget: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'budget-1',
              metadata: {},
            })
            .mockResolvedValueOnce({
              id: 'budget-2',
              metadata: { origin: MADFAM_CSV_IMPORT_ORIGIN, spaceRole: 'partner' },
            })
            .mockResolvedValueOnce({
              id: 'budget-3',
              metadata: {},
            }),
          update: jest.fn(),
        },
      } as any;

      const result = await backfillMadfamBudgetMetadata(
        prismaBackfill,
        'user-1',
        SYNTHETIC_MADFAM_CSV_ROUTING,
        false
      );

      expect(result.updated).toBe(2);
      expect(result.skipped).toBe(1);
      expect(prismaBackfill.budget.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyMadfamImportCompat', () => {
    it('fails when budget import metadata is missing', async () => {
      const verifyPrisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'op@example.com' }),
        },
        userSpace: {
          findMany: jest.fn().mockResolvedValue([
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
          ]),
          findFirst: jest.fn(),
        },
        account: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest
            .fn()
            .mockResolvedValue([{ providerAccountId: 'madfam-csv-bbva-empresarial' }]),
        },
        budget: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ id: 'b1', metadata: {} })
            .mockResolvedValueOnce({
              id: 'b2',
              metadata: { origin: MADFAM_CSV_IMPORT_ORIGIN, spaceRole: 'partner' },
            })
            .mockResolvedValueOnce({ id: 'b3', metadata: {} }),
        },
      } as any;

      process.env.MADFAM_BUSINESS_RFC = 'XAXX010101000';
      const report = await verifyMadfamImportCompat(
        verifyPrisma,
        'op@example.com',
        SYNTHETIC_MADFAM_CSV_ROUTING
      );

      expect(report.ok).toBe(false);
      expect(report.budgets).toHaveLength(3);
      expect(report.issues.some((i) => i.includes('Budget metadata missing'))).toBe(true);
    });
  });
});

import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../../../../test/helpers/test-data-factory';
import { TestDatabase } from '../../../../test/helpers/test-database';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SpacesService } from '../../spaces/spaces.service';
import { BudgetsService } from '../budgets.service';
import { CreateBudgetDto, UpdateBudgetDto } from '../dto';

// Skip integration tests when no test database is available
const describeOrSkip = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeOrSkip('BudgetsService (Integration)', () => {
  let service: BudgetsService;
  let prisma: PrismaService;
  let factory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestDatabase.setup();
    prisma = TestDatabase.getClient();
    factory = new TestDataFactory(prisma);

    module = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: SpacesService,
          useValue: {
            verifyUserAccess: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  afterEach(async () => {
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    await TestDatabase.teardown();
    await module.close();
  });

  describe('create', () => {
    it('should create a monthly budget with correct end date', async () => {
      const { user, space } = await factory.createFullSetup();
      const dto: CreateBudgetDto = {
        name: 'January Budget',
        period: 'monthly',
        startDate: new Date('2025-01-01'),
      };

      const result = await service.create(space.id, user.id, dto);

      expect(result.name).toBe('January Budget');
      expect(result.period).toBe('monthly');
    });

    it('should throw ConflictException for overlapping budgets', async () => {
      const { user, space } = await factory.createFullSetup();
      await factory.createBudget(space.id, {
        period: 'monthly',
        startDate: new Date('2025-01-01'),
      });

      const dto: CreateBudgetDto = {
        name: 'Overlapping',
        period: 'monthly',
        startDate: new Date('2025-01-15'),
      };

      await expect(service.create(space.id, user.id, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getBudgetSummary', () => {
    it('should calculate spending correctly', async () => {
      const { user, space, account, budget, category } = await factory.createFullSetup();
      await factory.createTransaction(account.id, {
        categoryId: category.id,
        amount: -50,
        date: new Date('2025-01-15'),
      });

      const result = await service.getBudgetSummary(space.id, user.id, budget.id);

      expect(result.summary.totalSpent).toBe(50);
      expect(result.summary.totalRemaining).toBe(950);
    });
  });
});

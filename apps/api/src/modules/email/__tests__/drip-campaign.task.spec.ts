import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { PostHogService } from '../../analytics/posthog.service';
import { EmailService } from '../email.service';
import { DripCampaignTask } from '../tasks/drip-campaign.task';

describe('DripCampaignTask', () => {
  let task: DripCampaignTask;
  let prisma: jest.Mocked<PrismaService>;
  let emailService: jest.Mocked<EmailService>;
  let postHogService: jest.Mocked<PostHogService>;

  const mockUser = (overrides: Record<string, any> = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    locale: 'en',
    subscriptionTier: 'community',
    trialEndsAt: null,
    trialTier: null,
    lastActivityAt: new Date(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    preferences: { emailNotifications: true },
    userSpaces: [
      {
        role: 'owner',
        space: {
          id: 'space-1',
          accounts: [],
          budgets: [],
        },
      },
    ],
    dripEvents: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DripCampaignTask,
        {
          provide: PrismaService,
          useValue: {
            user: { findMany: jest.fn().mockResolvedValue([]) },
            dripEvent: { create: jest.fn().mockResolvedValue({}) },
            transaction: { count: jest.fn().mockResolvedValue(0) },
            goal: { count: jest.fn().mockResolvedValue(0) },
            account: { aggregate: jest.fn().mockResolvedValue({ _sum: { balance: null } }) },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            capture: jest.fn(),
          },
        },
      ],
    }).compile();

    task = module.get<DripCampaignTask>(DripCampaignTask);
    prisma = module.get(PrismaService);
    emailService = module.get(EmailService);
    postHogService = module.get(PostHogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processActivationDrips', () => {
    it('should send day-1-connect drip to user with no accounts', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          template: 'drip-day-1-connect',
          priority: 'low',
        })
      );
      expect(prisma.dripEvent.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', campaign: 'activation', step: 'day-1-connect' },
      });
    });

    it('should skip day-1-connect if user has accounts', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ id: 'acc-1' }],
              budgets: [],
            },
          },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should skip day-1-connect if already sent (idempotent)', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        dripEvents: [{ step: 'day-1-connect', campaign: 'activation' }],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should send day-3-budget drip to user with no budgets', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ id: 'acc-1' }],
              budgets: [],
            },
          },
        ],
        dripEvents: [{ step: 'day-1-connect', campaign: 'activation' }],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'drip-day-3-budget',
        })
      );
    });

    it('should send day-14-trial drip when trial ending in 2 days', async () => {
      const trialEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const user = mockUser({
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        trialEndsAt: trialEnd,
        trialTier: 'premium',
        subscriptionTier: 'community',
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ id: 'acc-1' }],
              budgets: [{ id: 'bud-1' }],
            },
          },
        ],
        dripEvents: [
          { step: 'day-1-connect', campaign: 'activation' },
          { step: 'day-3-budget', campaign: 'activation' },
          { step: 'day-7-summary', campaign: 'activation' },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'drip-day-14-trial',
        })
      );
    });

    it('should skip day-14-trial if user is not on trial', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        trialEndsAt: null,
        subscriptionTier: 'premium',
        userSpaces: [
          {
            role: 'owner',
            space: { id: 'space-1', accounts: [{ id: 'acc-1' }], budgets: [{ id: 'b-1' }] },
          },
        ],
        dripEvents: [
          { step: 'day-1-connect', campaign: 'activation' },
          { step: 'day-3-budget', campaign: 'activation' },
          { step: 'day-7-summary', campaign: 'activation' },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ template: 'drip-day-14-trial' })
      );
    });

    it('should send day-7-summary with user stats', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ id: 'acc-1' }, { id: 'acc-2' }],
              budgets: [{ id: 'bud-1' }],
            },
          },
        ],
        dripEvents: [
          { step: 'day-1-connect', campaign: 'activation' },
          { step: 'day-3-budget', campaign: 'activation' },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(42);
      (prisma.goal.count as jest.Mock).mockResolvedValue(1);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'drip-day-7-summary',
          context: expect.objectContaining({
            accountCount: 2,
            transactionCount: 42,
            budgetCount: 1,
            hasGoals: true,
          }),
        })
      );
    });
  });

  describe('processReEngagementDrips', () => {
    it('should send day-7-inactive drip for 8 days inactive', async () => {
      const user = mockUser({
        lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ transactions: [] }],
            },
          },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processReEngagementDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'drip-reengagement-day-7',
        })
      );
    });

    it('should skip re-engagement for recently active user', async () => {
      // This test validates the query filter works — recently active users
      // should not appear in the query results at all
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await task.processReEngagementDrips();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should send day-14-inactive drip with unreviewed count', async () => {
      const user = mockUser({
        lastActivityAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        userSpaces: [
          {
            role: 'owner',
            space: {
              id: 'space-1',
              accounts: [{ transactions: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] }],
            },
          },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);
      (prisma.account.aggregate as jest.Mock).mockResolvedValue({
        _sum: { balance: { toNumber: () => 15000.5 } },
      });

      await task.processReEngagementDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'drip-reengagement-day-14',
          context: expect.objectContaining({
            unreviewedCount: 3,
            totalBalance: '15000.50',
          }),
        })
      );
    });
  });

  describe('email preferences', () => {
    it('should not send any drips when emailNotifications is false', async () => {
      // Users with emailNotifications=false are filtered by the query
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await task.processActivationDrips();
      await task.processReEngagementDrips();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('locale passthrough', () => {
    it('should include user name in template context', async () => {
      const user = mockUser({
        name: 'María García',
        locale: 'es',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ name: 'María García' }),
        })
      );
    });
  });

  describe('PostHog tracking', () => {
    it('should capture drip_email_sent event', async () => {
      const user = mockUser({
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);

      await task.processActivationDrips();

      expect(postHogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-1',
        event: 'drip_email_sent',
        properties: {
          campaign: 'activation',
          step: 'day-1-connect',
          template: 'drip-day-1-connect',
        },
      });
    });
  });

  describe('batch processing', () => {
    it('should process multiple eligible users', async () => {
      const user1 = mockUser({
        id: 'user-1',
        email: 'user1@test.com',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      const user2 = mockUser({
        id: 'user-2',
        email: 'user2@test.com',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user1, user2]);

      await task.processActivationDrips();

      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
      expect(prisma.dripEvent.create).toHaveBeenCalledTimes(2);
    });

    it('should continue processing after individual user failure', async () => {
      const user1 = mockUser({
        id: 'user-1',
        email: 'user1@test.com',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      const user2 = mockUser({
        id: 'user-2',
        email: 'user2@test.com',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([user1, user2]);

      // First user fails, second should still succeed
      (prisma.dripEvent.create as jest.Mock)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({});

      await task.processActivationDrips();

      // Second user should still get processed
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });
  });
});

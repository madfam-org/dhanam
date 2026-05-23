import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  CheckoutRouteOverrideService,
  ROUTE_OVERRIDE_AUDIT_ACTION,
} from '../services/checkout-route-override.service';

describe('CheckoutRouteOverrideService', () => {
  let service: CheckoutRouteOverrideService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutRouteOverrideService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(CheckoutRouteOverrideService);
    prisma = module.get(PrismaService);
  });

  it('stores override in audit log', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    const record = await service.setOverride({
      targetUserId: 'user-1',
      product: 'dhanam',
      provider: 'stripe_mx',
      reason: 'staging drill',
      operatorId: 'admin-1',
      ttlHours: 1,
    });

    expect(record.provider).toBe('stripe_mx');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: ROUTE_OVERRIDE_AUDIT_ACTION,
          resourceId: 'user-1:dhanam',
        }),
      })
    );
  });

  it('returns active override when not cleared or expired', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        action: ROUTE_OVERRIDE_AUDIT_ACTION,
        metadata: JSON.stringify({
          targetUserId: 'user-1',
          product: 'dhanam',
          provider: 'paddle',
          reason: 'test',
          operatorId: 'admin-1',
          expiresAt,
          createdAt: new Date().toISOString(),
        }),
      },
    ]);

    const active = await service.getActiveOverride('user-1', 'dhanam');
    expect(active?.provider).toBe('paddle');
  });
});

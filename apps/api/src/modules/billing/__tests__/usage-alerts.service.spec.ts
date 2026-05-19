import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { UsageAlertsService, WaybillAlertPayload } from '../services/usage-alerts.service';

describe('UsageAlertsService (P2.2)', () => {
  let service: UsageAlertsService;
  let prisma: {
    usageAlertIngest: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let email: { sendEmail: jest.Mock };
  let config: { get: jest.Mock };

  const samplePayload: WaybillAlertPayload = {
    alert_id: '00000000-0000-0000-0000-000000000001',
    project_id: '00000000-0000-0000-0000-000000000002',
    budget_id: '00000000-0000-0000-0000-000000000003',
    period: 'monthly',
    period_start: '2026-04-01T00:00:00.000Z',
    period_end: '2026-05-01T00:00:00.000Z',
    threshold_crossed: 80,
    actual_cents: 40_00,
    budget_cents: 50_00,
    currency: 'USD',
  };

  beforeEach(async () => {
    prisma = {
      usageAlertIngest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    email = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'WAYBILL_ALERT_FALLBACK_EMAIL') return 'ops@example.com';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageAlertsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(UsageAlertsService);
  });

  it('stores and notifies on first-seen event', async () => {
    prisma.usageAlertIngest.findUnique.mockResolvedValue(null);
    prisma.usageAlertIngest.create.mockResolvedValue({ id: 'row-1' });
    prisma.usageAlertIngest.update.mockResolvedValue({ id: 'row-1' });

    const result = await service.ingest(samplePayload);
    expect(result.status).toBe('accepted');
    expect(result.notified).toBe(true);
    expect(prisma.usageAlertIngest.create).toHaveBeenCalledTimes(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0][0].to).toBe('ops@example.com');
    expect(email.sendEmail.mock.calls[0][0].template).toBe('budget-alert');
  });

  it('returns duplicate without re-notifying for repeat tuple', async () => {
    prisma.usageAlertIngest.findUnique.mockResolvedValue({ id: 'existing-1', seenCount: 1 });
    prisma.usageAlertIngest.update.mockResolvedValue({ id: 'existing-1' });

    const result = await service.ingest(samplePayload);
    expect(result.status).toBe('duplicate');
    expect(result.notified).toBe(false);
    expect(prisma.usageAlertIngest.create).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
    // Updated with seenCount increment.
    expect(prisma.usageAlertIngest.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.usageAlertIngest.update.mock.calls[0][0];
    expect(updateCall.data.seenCount).toEqual({ increment: 1 });
  });

  it('rejects payload missing required fields', async () => {
    const bad = { ...samplePayload, alert_id: undefined } as unknown as WaybillAlertPayload;
    await expect(service.ingest(bad)).rejects.toThrow(/missing required field/);
  });

  it('rejects payload with negative threshold', async () => {
    const bad = { ...samplePayload, threshold_crossed: -1 };
    await expect(service.ingest(bad)).rejects.toThrow(/threshold_crossed/);
  });

  it('rejects payload with non-integer cents', async () => {
    const bad = { ...samplePayload, actual_cents: 12.5 };
    await expect(service.ingest(bad)).rejects.toThrow(/actual_cents/);
  });

  it('rejects payload with zero budget', async () => {
    const bad = { ...samplePayload, budget_cents: 0 };
    await expect(service.ingest(bad)).rejects.toThrow(/budget_cents/);
  });

  it('marks 100% alerts as high priority', async () => {
    prisma.usageAlertIngest.findUnique.mockResolvedValue(null);
    prisma.usageAlertIngest.create.mockResolvedValue({ id: 'row-100' });
    prisma.usageAlertIngest.update.mockResolvedValue({});

    const hot = { ...samplePayload, threshold_crossed: 100 };
    await service.ingest(hot);
    expect(email.sendEmail.mock.calls[0][0].priority).toBe('high');
  });

  it('stores but does not notify when fallback email not configured', async () => {
    prisma.usageAlertIngest.findUnique.mockResolvedValue(null);
    prisma.usageAlertIngest.create.mockResolvedValue({ id: 'row-no-mail' });
    config.get.mockReturnValue(undefined);

    const result = await service.ingest(samplePayload);
    expect(result.status).toBe('accepted');
    expect(result.notified).toBe(false);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('treats malformed period_start as a validation error', async () => {
    const bad = { ...samplePayload, period_start: 'not-a-date' };
    await expect(service.ingest(bad)).rejects.toThrow(/period_start/);
  });

  it('still returns success when email send fails (alert is stored)', async () => {
    prisma.usageAlertIngest.findUnique.mockResolvedValue(null);
    prisma.usageAlertIngest.create.mockResolvedValue({ id: 'row-1' });
    email.sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await service.ingest(samplePayload);
    expect(result.status).toBe('accepted');
    expect(result.notified).toBe(false); // notify failed but ingest succeeded
  });
});

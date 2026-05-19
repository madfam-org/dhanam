import * as crypto from 'crypto';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { UsageAlertsService, WaybillAlertPayload } from '../services/usage-alerts.service';
import { UsageAlertsController } from '../usage-alerts.controller';

describe('UsageAlertsController (P2.2)', () => {
  let controller: UsageAlertsController;
  let service: jest.Mocked<UsageAlertsService>;

  const SIGNING_KEY = 'test-waybill-signing-key';

  const samplePayload: WaybillAlertPayload = {
    alert_id: '00000000-0000-0000-0000-000000000001',
    project_id: '00000000-0000-0000-0000-000000000002',
    budget_id: '00000000-0000-0000-0000-000000000003',
    period: 'monthly',
    period_start: '2026-04-01T00:00:00Z',
    period_end: '2026-05-01T00:00:00Z',
    threshold_crossed: 80,
    actual_cents: 40_00,
    budget_cents: 50_00,
    currency: 'USD',
  };

  function signEnvelope(rawBody: string, ts = Math.floor(Date.now() / 1000)): string {
    const hmac = crypto.createHmac('sha256', SIGNING_KEY).update(`${ts}.${rawBody}`).digest('hex');
    return `t=${ts},v1=${hmac}`;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageAlertsController],
      providers: [
        {
          provide: UsageAlertsService,
          useValue: {
            ingest: jest.fn().mockResolvedValue({
              status: 'accepted',
              alertId: 'ingest-1',
              threshold: 80,
              notified: true,
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            usageAlertIngest: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'WAYBILL_ALERT_SIGNING_KEY') return SIGNING_KEY;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(UsageAlertsController);
    service = module.get(UsageAlertsService) as jest.Mocked<UsageAlertsService>;
  });

  function makeReq(body: unknown): any {
    const raw = JSON.stringify(body);
    return { rawBody: raw, body };
  }

  it('accepts a correctly-signed payload', async () => {
    const req = makeReq(samplePayload);
    const sig = signEnvelope(req.rawBody);
    const result = await controller.ingest(req, sig, samplePayload);
    expect(result.status).toBe('accepted');
    expect(service.ingest).toHaveBeenCalledWith(samplePayload);
  });

  it('rejects missing signature header', async () => {
    const req = makeReq(samplePayload);
    await expect(controller.ingest(req, undefined as any, samplePayload)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects signature with wrong secret', async () => {
    const req = makeReq(samplePayload);
    const ts = Math.floor(Date.now() / 1000);
    const badHmac = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(`${ts}.${req.rawBody}`)
      .digest('hex');
    await expect(controller.ingest(req, `t=${ts},v1=${badHmac}`, samplePayload)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects replayed signatures outside the window', async () => {
    const req = makeReq(samplePayload);
    const oldTs = Math.floor(Date.now() / 1000) - 60 * 60; // 1 hour ago
    const sig = signEnvelope(req.rawBody, oldTs);
    await expect(controller.ingest(req, sig, samplePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects malformed header', async () => {
    const req = makeReq(samplePayload);
    await expect(controller.ingest(req, 'garbage', samplePayload)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('bubbles validation failures as 400', async () => {
    const req = makeReq(samplePayload);
    const sig = signEnvelope(req.rawBody);
    service.ingest.mockRejectedValueOnce(new Error('missing required field: alert_id'));
    await expect(controller.ingest(req, sig, samplePayload)).rejects.toThrow(BadRequestException);
  });

  it('rejects when the server has no signing key configured', async () => {
    const noKeyModule = await Test.createTestingModule({
      controllers: [UsageAlertsController],
      providers: [
        { provide: UsageAlertsService, useValue: { ingest: jest.fn() } },
        {
          provide: PrismaService,
          useValue: { usageAlertIngest: { findMany: jest.fn() } },
        },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const c = noKeyModule.get(UsageAlertsController);
    const req = makeReq(samplePayload);
    await expect(c.ingest(req, 't=0,v1=abc', samplePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('list() coerces BigInt cents to Number', async () => {
    const fakeRows = [
      {
        id: 'x',
        actualCents: BigInt(40_00),
        budgetCents: BigInt(50_00),
        createdAt: new Date(),
      },
    ];
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsageAlertsController],
      providers: [
        { provide: UsageAlertsService, useValue: { ingest: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            usageAlertIngest: { findMany: jest.fn().mockResolvedValue(fakeRows) },
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    const c = moduleRef.get(UsageAlertsController);
    const out = await c.list();
    expect(typeof out.alerts[0].actualCents).toBe('number');
    expect(out.alerts[0].actualCents).toBe(4000);
  });

  it('uses req.body json when rawBody is missing', async () => {
    // Emulate a framework that did not attach rawBody (fall-through path).
    const body = { ...samplePayload };
    const req: any = { body };
    const rawEquivalent = JSON.stringify(body);
    const sig = signEnvelope(rawEquivalent);
    const result = await controller.ingest(req, sig, body);
    expect(result.status).toBe('accepted');
  });
});

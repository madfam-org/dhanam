import { readFileSync } from 'fs';
import { join } from 'path';

import { PaymentRouteFeeScheduleService } from '../services/payment-route-fee-schedule.service';
import type { FeeScheduleFile } from '../config/payment-route-fee-schedule';

describe('PaymentRouteFeeScheduleService', () => {
  const bundled: FeeScheduleFile = JSON.parse(
    readFileSync(join(__dirname, '..', 'config', 'payment-route-fee-schedule.bundled.json'), 'utf8')
  );

  it('loads bundled schedule on reload when no platform override exists', async () => {
    const platformConfig = {
      get: jest.fn().mockResolvedValue(null),
    };

    const service = new PaymentRouteFeeScheduleService(platformConfig as any);
    await service.reload();

    const schedule = service.getSchedule();
    expect(schedule.source).toBe('file');
    expect(schedule.entries.length).toBeGreaterThan(0);
    expect(schedule.version).toBe(bundled.version);
  });

  it('prefers platform_config override when present', async () => {
    const overrideEntries = bundled.entries.slice(0, 2);
    const platformConfig = {
      get: jest.fn().mockResolvedValue({
        value: { version: 'test-override', entries: overrideEntries },
      }),
      upsert: jest.fn(),
      deleteKey: jest.fn(),
    };

    const service = new PaymentRouteFeeScheduleService(platformConfig as any);
    await service.reload();

    const schedule = service.getSchedule();
    expect(schedule.source).toBe('platform_config');
    expect(schedule.version).toBe('test-override');
    expect(schedule.entries).toHaveLength(2);
  });

  it('upserts platform override and reloads', async () => {
    const platformConfig = {
      get: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteKey: jest.fn(),
    };

    const service = new PaymentRouteFeeScheduleService(platformConfig as any);
    await service.reload();

    platformConfig.get.mockResolvedValue({
      value: { version: 'ops-2026', entries: bundled.entries.slice(0, 3) },
    });

    const result = await service.upsertPlatformOverride({
      version: 'ops-2026',
      entries: bundled.entries.slice(0, 3),
      updatedBy: 'admin-1',
    });

    expect(platformConfig.upsert).toHaveBeenCalled();
    expect(result.entryCount).toBe(3);
    expect(service.getSchedule().source).toBe('platform_config');
  });
});

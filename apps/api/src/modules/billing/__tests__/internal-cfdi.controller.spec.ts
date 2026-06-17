import * as crypto from 'crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { InternalCfdiController } from '../internal-cfdi.controller';
import { CfdiTimelineService } from '../services/cfdi-timeline.service';

describe('InternalCfdiController', () => {
  let controller: InternalCfdiController;
  const attachCfdiUuid = jest.fn().mockResolvedValue(1);
  const secret = 'test-webhook-secret';

  const sign = (body: string) => crypto.createHmac('sha256', secret).update(body).digest('hex');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalCfdiController],
      providers: [
        {
          provide: CfdiTimelineService,
          useValue: { attachCfdiUuid },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'DHANAM_WEBHOOK_SECRET' ? secret : undefined),
          },
        },
      ],
    }).compile();

    controller = module.get(InternalCfdiController);
    attachCfdiUuid.mockClear();
  });

  it('records CFDI UUID when HMAC matches raw body', async () => {
    const dto = {
      payment_id: 'pi_test_123',
      cfdi_uuid: '11111111-2222-3333-4444-555555555555',
      source: 'karafiel',
    };
    const rawBody = JSON.stringify(dto);

    const result = await controller.recordCfdiIssued({ rawBody } as never, sign(rawBody), dto);

    expect(attachCfdiUuid).toHaveBeenCalledWith('pi_test_123', dto.cfdi_uuid);
    expect(result).toEqual({
      status: 'ok',
      updated: 1,
      payment_id: 'pi_test_123',
      cfdi_uuid: dto.cfdi_uuid,
    });
  });

  it('accepts compact JSON fallback when rawBody is missing', async () => {
    const dto = {
      payment_id: 'pi_compact',
      cfdi_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    };
    const compact = JSON.stringify({
      payment_id: dto.payment_id,
      cfdi_uuid: dto.cfdi_uuid,
      source: 'karafiel',
    });

    await controller.recordCfdiIssued({} as never, sign(compact), dto);

    expect(attachCfdiUuid).toHaveBeenCalledWith('pi_compact', dto.cfdi_uuid);
  });

  it('rejects missing signature header', async () => {
    await expect(
      controller.recordCfdiIssued({} as never, '', {
        payment_id: 'pi_x',
        cfdi_uuid: 'uuid-x',
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    const dto = { payment_id: 'pi_bad', cfdi_uuid: 'uuid-bad' };
    const rawBody = JSON.stringify(dto);

    await expect(
      controller.recordCfdiIssued({ rawBody } as never, 'deadbeef', dto)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

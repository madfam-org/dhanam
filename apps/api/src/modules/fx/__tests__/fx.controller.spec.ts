import { Test, TestingModule } from '@nestjs/testing';

import { FxController } from '../fx.controller';
import { FxService } from '../fx.service';
import { FxRateType, FxRateResponse } from '../dto/fx-rate.dto';

describe('FxController', () => {
  let controller: FxController;
  let fxService: jest.Mocked<FxService>;

  const fxRateResponse: FxRateResponse = {
    from: 'USD',
    to: 'MXN',
    rate: '20.5000',
    type: FxRateType.spot,
    source: 'dhanam:fx:spot',
    observed_at: new Date('2026-06-01T12:00:00.000Z').toISOString(),
    effective_at: new Date('2026-06-01T12:00:00.000Z').toISOString(),
    stale_after: new Date('2026-06-01T12:05:00.000Z').toISOString(),
    provenance: {
      provider_id: 'fallback',
      fallback_chain_used: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FxController],
      providers: [
        {
          provide: FxService,
          useValue: {
            getRate: jest.fn().mockResolvedValue(fxRateResponse),
          },
        },
      ],
    }).compile();

    controller = module.get(FxController);
    fxService = module.get(FxService) as jest.Mocked<FxService>;
  });

  describe('GET /v1/fx/rate', () => {
    it('defaults allow_stale to true when omitted', async () => {
      const result = await controller.getRate({
        from: 'USD',
        to: 'MXN',
        type: FxRateType.spot,
      });

      expect(result).toEqual(fxRateResponse);
      expect(fxService.getRate).toHaveBeenCalledWith({
        from: 'USD',
        to: 'MXN',
        type: FxRateType.spot,
        at: undefined,
        paymentId: undefined,
        allowStale: true,
      });
    });

    it('respects allow_stale=false from query', async () => {
      await controller.getRate({
        from: 'USD',
        to: 'MXN',
        type: FxRateType.spot,
        allow_stale: 'false',
      });

      expect(fxService.getRate).toHaveBeenCalledWith({
        from: 'USD',
        to: 'MXN',
        type: FxRateType.spot,
        at: undefined,
        paymentId: undefined,
        allowStale: false,
      });
    });
  });
});

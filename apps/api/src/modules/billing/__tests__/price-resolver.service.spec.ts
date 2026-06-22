import { mxnGrossCentavosFromNet } from '@dhanam/shared';

import { PriceResolverService } from '../services/price-resolver.service';

describe('PriceResolverService MXN gross amounts', () => {
  let service: PriceResolverService;
  let prisma: { productPrice: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = {
      productPrice: {
        findFirst: jest.fn(),
      },
    };
    service = new PriceResolverService({} as never, prisma as never);
  });

  it('resolveAmountMinor returns IVA-inclusive gross centavos for MXN essentials', async () => {
    prisma.productPrice.findFirst.mockResolvedValue({ amountCents: 7900 });

    const amount = await service.resolveAmountMinor('essentials', 3);

    expect(amount).toBe(mxnGrossCentavosFromNet(7900));
    expect(amount).toBe(9200);
  });
});

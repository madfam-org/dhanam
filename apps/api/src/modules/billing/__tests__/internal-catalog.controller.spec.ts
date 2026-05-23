import { Test, TestingModule } from '@nestjs/testing';

import { InternalCatalogController } from '../internal-catalog.controller';
import { CatalogApplySecretGuard } from '../guards/catalog-apply-secret.guard';
import { ProductCatalogService } from '../services/product-catalog.service';

describe('InternalCatalogController', () => {
  let controller: InternalCatalogController;
  const applyApprovedCatalogPrice = jest.fn().mockResolvedValue({
    productSlug: 'karafiel',
    tierSlug: 'contador',
    amountCents: 129900,
    currency: 'MXN',
    interval: 'month',
    dhanamTier: 'contador',
    productPriceId: 'price_1',
    tierId: 'tier_1',
  });

  beforeEach(async () => {
    applyApprovedCatalogPrice.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalCatalogController],
      providers: [
        {
          provide: ProductCatalogService,
          useValue: { applyApprovedCatalogPrice },
        },
      ],
    })
      .overrideGuard(CatalogApplySecretGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InternalCatalogController);
  });

  it('delegates to applyApprovedCatalogPrice', async () => {
    const body = {
      product_slug: 'karafiel',
      tier_slug: 'contador',
      amount_cents: 129900,
      source: 'tulana_selva',
      approval_id: 'apr-1',
    };
    const res = await controller.applyPrice(body as any);
    expect(applyApprovedCatalogPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        productSlug: 'karafiel',
        tierSlug: 'contador',
        amountCents: 129900,
        source: 'tulana_selva',
        approvalId: 'apr-1',
      }),
    );
    expect(res.success).toBe(true);
    expect(res.amountCents).toBe(129900);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Currency } from '@db';
import { InternalCatalogController } from '../internal-catalog.controller';
import { ProductCatalogService } from '../services/product-catalog.service';
import { CatalogApplySecretGuard } from '../guards/catalog-apply-secret.guard';

describe('InternalCatalogController', () => {
  let controller: InternalCatalogController;
  const applyApprovedCatalogPrice = jest.fn().mockResolvedValue({
    ok: true,
    product: { id: 'prod-1', slug: 'karafiel', name: 'Karafiel' },
    price: {
      id: 'price-1',
      tierSlug: 'contador',
      amountCents: 129900,
      currency: Currency.MXN,
      interval: 'month',
    },
    created: true,
  });
  const lookupPricesByIds = jest.fn().mockResolvedValue([
    {
      id: 'price-1',
      productSlug: 'karafiel',
      tierSlug: 'contador',
      amountCents: 129900,
      currency: Currency.MXN,
      interval: 'monthly',
    },
  ]);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalCatalogController],
      providers: [
        {
          provide: ProductCatalogService,
          useValue: { applyApprovedCatalogPrice, lookupPricesByIds },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'DHANAM_CATALOG_APPLY_SECRET' ? 'test-secret' : undefined,
          },
        },
        CatalogApplySecretGuard,
      ],
    }).compile();

    controller = module.get(InternalCatalogController);
    applyApprovedCatalogPrice.mockClear();
    lookupPricesByIds.mockClear();
  });

  it('applies price when secret matches', async () => {
    const result = await controller.applyPrice({
      product_slug: 'karafiel',
      tier_slug: 'contador',
      amount_cents: 129900,
      currency: 'MXN',
      interval: 'month',
      source: 'tulana_selva_hitl',
      approval_id: 'appr-1',
      recommendation_id: 42,
    });
    expect(applyApprovedCatalogPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        productSlug: 'karafiel',
        tierSlug: 'contador',
        amountCents: 129900,
        interval: 'month',
        source: 'tulana_selva_hitl',
      })
    );
    expect(result.ok).toBe(true);
    expect(result.price.amountCents).toBe(129900);
    expect(result.product.slug).toBe('karafiel');
  });

  it('defaults interval to monthly when omitted', async () => {
    await controller.applyPrice({
      product_slug: 'karafiel',
      tier_slug: 'contador',
      amount_cents: 129900,
    });
    expect(applyApprovedCatalogPrice).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 'monthly' })
    );
  });

  it('looks up prices by id batch', async () => {
    const result = await controller.lookupPrices({
      ids: ['price-1'],
    });
    expect(lookupPricesByIds).toHaveBeenCalledWith(['price-1']);
    expect(result.prices[0].amountCents).toBe(129900);
  });
});

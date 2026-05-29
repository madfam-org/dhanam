import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApplyCatalogPriceDto } from './dto/apply-catalog-price.dto';
import { CatalogApplySecretGuard } from './guards/catalog-apply-secret.guard';
import { ProductCatalogService } from './services/product-catalog.service';

/**
 * Service-to-service catalog mutations (Tulana → Selva HITL → Dhanam).
 * Not exposed to end-user JWT auth.
 */
@ApiTags('internal-catalog')
@Controller('internal/catalog')
export class InternalCatalogController {
  constructor(private readonly catalog: ProductCatalogService) {}

  @Post('apply-price')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CatalogApplySecretGuard)
  @ApiOperation({
    summary: 'Apply approved Tulana price to catalog (internal)',
    description:
      'Upserts Product + ProductPrice from Selva pricing_proposal approval. ' +
      'Requires shared secret header.',
  })
  @ApiHeader({
    name: 'X-Dhanam-Catalog-Apply-Secret',
    required: true,
    description: 'Must match DHANAM_CATALOG_APPLY_SECRET (or TULANA_SELVA_CATALOG_APPLY_SECRET)',
  })
  async applyPrice(@Body() body: ApplyCatalogPriceDto) {
    const metadata = {
      ...(body.metadata || {}),
      applied_via: body.source || 'tulana_selva_hitl',
      recommendation_id: body.recommendation_id ?? null,
      selva_approval_id: body.approval_id ?? null,
    };
    return this.catalog.applyApprovedCatalogPrice({
      productSlug: body.product_slug,
      tierSlug: body.tier_slug,
      amountCents: body.amount_cents,
      currency: (body.currency as 'MXN' | 'USD' | 'EUR' | 'CAD') || 'MXN',
      interval: body.interval || 'monthly',
      dhanamTier: body.dhanam_tier,
      displayName: body.display_name,
      metadata,
      source: body.source,
    });
  }
}

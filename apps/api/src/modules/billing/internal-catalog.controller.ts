import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApplyCatalogPriceDto } from './dto/apply-catalog-price.dto';
import { CatalogApplySecretGuard } from './guards/catalog-apply-secret.guard';
import { ProductCatalogService } from './services/product-catalog.service';

/**
 * Service-to-service catalog apply (Tulana/Selva after HITL).
 * Not exposed to end-user JWT auth — secret header only.
 */
@ApiTags('internal-catalog')
@Controller('internal/catalog')
@UseGuards(CatalogApplySecretGuard)
export class InternalCatalogController {
  constructor(private readonly catalog: ProductCatalogService) {}

  @Post('apply-price')
  @ApiOperation({
    summary: 'Apply an approved catalog price (internal, Tulana/Selva pipeline)',
  })
  async applyPrice(@Body() body: ApplyCatalogPriceDto) {
    const result = await this.catalog.applyApprovedCatalogPrice({
      productSlug: body.product_slug,
      tierSlug: body.tier_slug,
      amountCents: body.amount_cents,
      currency: body.currency,
      interval: body.interval,
      dhanamTier: body.dhanam_tier,
      displayName: body.display_name,
      source: body.source,
      recommendationId: body.recommendation_id,
      approvalId: body.approval_id,
      metadata: body.metadata,
    });
    return { success: true, ...result };
  }
}

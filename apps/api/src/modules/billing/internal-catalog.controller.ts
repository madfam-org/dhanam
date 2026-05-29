import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApplyCatalogPriceDto } from './dto/apply-catalog-price.dto';
import { LookupCatalogPricesDto } from './dto/lookup-catalog-prices.dto';
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

  @Post('prices/lookup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CatalogApplySecretGuard)
  @ApiOperation({
    summary: 'Lookup applied catalog prices by ProductPrice id (internal)',
    description:
      'Batch read of product_prices rows for Tulana post-apply reconciliation. ' +
      'Public GET /billing/catalog may serve catalog.yaml in production; use this for DB truth.',
  })
  @ApiHeader({
    name: 'X-Dhanam-Catalog-Apply-Secret',
    required: true,
  })
  async lookupPrices(@Body() body: LookupCatalogPricesDto) {
    const prices = await this.catalog.lookupPricesByIds(body.ids);
    return { prices };
  }

  @Get('prices/:id')
  @UseGuards(CatalogApplySecretGuard)
  @ApiOperation({ summary: 'Lookup one applied catalog price by ProductPrice id (internal)' })
  @ApiHeader({
    name: 'X-Dhanam-Catalog-Apply-Secret',
    required: true,
  })
  async lookupPrice(@Param('id') id: string) {
    const [price] = await this.catalog.lookupPricesByIds([id]);
    if (!price) {
      return { price: null };
    }
    return { price };
  }
}

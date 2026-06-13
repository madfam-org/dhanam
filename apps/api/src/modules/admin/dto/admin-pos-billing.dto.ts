import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsArray, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class AdminPosChargeDto {
  @ApiProperty({ description: 'Dhanam user id to charge' })
  @IsString()
  @Length(1, 128)
  userId!: string;

  @ApiProperty({ description: 'Amount in minor units (centavos/cents)', example: 19900 })
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'MXN' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ description: 'Charge description shown on the receipt' })
  @IsString()
  @Length(1, 512)
  description!: string;

  @ApiPropertyOptional({ description: 'Stripe MX / Conekta payment method override' })
  @IsOptional()
  @IsIn(['card', 'oxxo', 'customer_balance', 'spei'])
  paymentMethod?: 'card' | 'oxxo' | 'customer_balance' | 'spei';

  @ApiPropertyOptional({ description: 'Force POS provider (auto = country/currency default)' })
  @IsOptional()
  @IsIn(['auto', 'stripe_mx', 'conekta', 'legacy_stripe'])
  provider?: 'auto' | 'stripe_mx' | 'conekta' | 'legacy_stripe';

  @ApiPropertyOptional({ description: 'Correlation id for POS timeline grouping' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  correlationId?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code for routing' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}

export class AdminPosRefundDto {
  @ApiProperty({ description: 'Stripe PaymentIntent id or Conekta order id to refund' })
  @IsString()
  @Matches(/^(pi_[a-zA-Z0-9]+|ord_[a-zA-Z0-9]+)$/, {
    message: 'paymentIntentId must be a Stripe PaymentIntent (pi_*) or Conekta order (ord_*) id',
  })
  paymentIntentId!: string;

  @ApiPropertyOptional({ description: 'Partial refund amount in minor units' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @ApiPropertyOptional({ description: 'Refund reason forwarded to Stripe' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  reason?: string;

  @ApiPropertyOptional({ description: 'Correlation id for POS timeline grouping' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  correlationId?: string;
}

export class AdminRoutePreviewDto {
  @ApiProperty({ description: 'Dhanam user id for the checkout' })
  @IsString()
  @Length(1, 128)
  userId!: string;

  @ApiProperty({ description: 'Plan slug', example: 'pro' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*(?:_(?:monthly|yearly|annual))?$/)
  plan!: string;

  @ApiPropertyOptional({ description: 'Product slug', example: 'dhanam' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9]*$/)
  product?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Force a specific route provider for dry-run' })
  @IsOptional()
  @IsIn(['janua', 'stripe_mx', 'paddle', 'legacy_stripe'])
  providerOverride?: 'janua' | 'stripe_mx' | 'paddle' | 'legacy_stripe';

  @ApiPropertyOptional({ description: 'Amount in minor units for fee-aware routing preview' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @ApiPropertyOptional({ description: 'Preferred payment instrument for fee ranking' })
  @IsOptional()
  @IsIn(['card', 'spei', 'customer_balance', 'oxxo', 'paypal', 'apple_pay', 'google_pay'])
  paymentMethod?: string;
}

export class AdminRouteOverrideDto {
  @ApiProperty({ description: 'Dhanam user id for checkout routing' })
  @IsString()
  @Length(1, 128)
  userId!: string;

  @ApiPropertyOptional({ description: 'Product slug', example: 'dhanam' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9]*$/)
  product?: string;

  @ApiProperty({ description: 'Forced checkout provider' })
  @IsIn(['janua', 'stripe_mx', 'paddle', 'legacy_stripe'])
  provider!: 'janua' | 'stripe_mx' | 'paddle' | 'legacy_stripe';

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country scope' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiProperty({ description: 'Operator reason (audit trail)' })
  @IsString()
  @Length(3, 512)
  reason!: string;

  @ApiPropertyOptional({ description: 'Override TTL in hours (default 24)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlHours?: number;
}

export class AdminRouteOverrideClearDto {
  @ApiProperty({ description: 'Dhanam user id' })
  @IsString()
  @Length(1, 128)
  userId!: string;

  @ApiPropertyOptional({ description: 'Product slug', example: 'dhanam' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9]*$/)
  product?: string;

  @ApiPropertyOptional({ description: 'Clear reason' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  reason?: string;
}

export class AdminRouteFeeScheduleUpsertDto {
  @ApiProperty({ description: 'Schedule version label', example: '2026-06-12' })
  @IsString()
  @Length(1, 64)
  version!: string;

  @ApiProperty({ description: 'Fee schedule entries (validated server-side)' })
  @IsArray()
  entries!: unknown[];
}

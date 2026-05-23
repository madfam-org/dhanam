import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Stripe MX payment method override' })
  @IsOptional()
  @IsIn(['card', 'oxxo', 'customer_balance'])
  paymentMethod?: 'card' | 'oxxo' | 'customer_balance';

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
  @ApiProperty({ description: 'Stripe PaymentIntent id to refund' })
  @IsString()
  @Matches(/^pi_[a-zA-Z0-9]+$/, { message: 'paymentIntentId must be a Stripe PaymentIntent id' })
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
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CheckoutRouteRecommendationQueryDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code', example: 'MX' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ description: 'Plan slug', example: 'pro' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*(?:_(?:monthly|yearly|annual))?$/)
  plan?: string;

  @ApiPropertyOptional({ description: 'Product slug', example: 'dhanam' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9]*$/)
  product?: string;

  @ApiPropertyOptional({
    description: 'Checkout amount in minor units when known (overrides plan default)',
    example: 19900,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency for amountMinor',
    example: 'MXN',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Preferred payment instrument for fee ranking',
    enum: ['card', 'spei', 'customer_balance', 'oxxo', 'paypal', 'apple_pay', 'google_pay'],
  })
  @IsOptional()
  @IsIn(['card', 'spei', 'customer_balance', 'oxxo', 'paypal', 'apple_pay', 'google_pay'])
  paymentMethod?: string;
}

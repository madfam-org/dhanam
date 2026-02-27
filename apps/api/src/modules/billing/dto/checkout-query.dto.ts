import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

const VALID_PLANS = [
  'essentials', 'pro', 'madfam',
  'essentials_yearly', 'pro_yearly', 'madfam_yearly',
  // Product-prefixed plans
  'enclii_essentials', 'enclii_pro', 'enclii_madfam',
  'tezca_essentials', 'tezca_pro', 'tezca_madfam',
  'yantra4d_essentials', 'yantra4d_pro', 'yantra4d_madfam',
  'dhanam_essentials', 'dhanam_pro', 'dhanam_madfam',
  // Legacy plans (backwards compat)
  'sovereign', 'enclii_sovereign', 'enclii_ecosystem',
] as const;

const VALID_PRODUCTS = ['enclii', 'tezca', 'yantra4d', 'dhanam'] as const;

export class CheckoutQueryDto {
  @ApiProperty({ enum: VALID_PLANS, description: 'Subscription plan (optionally product-prefixed)' })
  @IsIn(VALID_PLANS)
  plan: (typeof VALID_PLANS)[number];

  @ApiProperty({ description: 'Janua user ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'URL to redirect after checkout' })
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'return_url must be a valid URL' })
  return_url: string;

  @ApiPropertyOptional({ enum: VALID_PRODUCTS, description: 'Product being upgraded (defaults to dhanam)' })
  @IsOptional()
  @IsIn(VALID_PRODUCTS)
  product?: (typeof VALID_PRODUCTS)[number];
}

import { IsIn, IsOptional, IsString } from 'class-validator';

const VALID_PRODUCTS = ['enclii', 'tezca', 'yantra4d', 'dhanam'] as const;

export class UpgradeToPremiumDto {
  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;

  /**
   * Janua organization ID (for external app integration)
   * When provided, the subscription is linked to this organization
   */
  @IsOptional()
  @IsString()
  orgId?: string;

  /**
   * Plan ID (e.g., 'enclii_pro', 'tezca_pro', 'dhanam_pro')
   * Used to select the appropriate product/price in the payment provider
   */
  @IsOptional()
  @IsString()
  plan?: string;

  /**
   * Product being upgraded (defaults to 'dhanam')
   */
  @IsOptional()
  @IsIn(VALID_PRODUCTS)
  product?: (typeof VALID_PRODUCTS)[number];

  /**
   * Country code for provider routing (e.g., 'MX', 'US')
   * Determines which payment provider to use (Conekta for MX, Polar for others)
   */
  @IsOptional()
  @IsString()
  countryCode?: string;
}

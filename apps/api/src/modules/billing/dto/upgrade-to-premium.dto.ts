import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

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
   * Plan ID (e.g., 'enclii_pro', 'tezca_pro', 'karafiel_contador')
   * Used to select the appropriate product/price in the payment provider
   */
  @IsOptional()
  @IsString()
  plan?: string;

  /**
   * Product being upgraded (lowercase catalog slug, e.g. 'karafiel').
   * Defaults to 'dhanam'.
   */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'product must be a lowercase catalog slug' })
  product?: string;

  /**
   * Country code for provider routing (e.g., 'MX', 'US')
   * Determines which payment provider to use (Conekta for MX, Polar for others)
   */
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Preferred payment instrument for fee-optimal routing (e.g. spei, card)',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

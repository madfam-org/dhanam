import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsUUID, Matches } from 'class-validator';

import { IsValidPlanId } from '../validators/plan-id.validator';

export class CheckoutQueryDto {
  @ApiProperty({
    description:
      'Subscription plan ID. Format: {product}_{tier} (e.g. "karafiel_contador"), bare tier (e.g. "pro"), or legacy plan name.',
    example: 'karafiel_contador',
  })
  @IsValidPlanId()
  plan: string;

  @ApiProperty({ description: 'Janua user ID' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'URL to redirect after checkout' })
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'return_url must be a valid URL' })
  return_url: string;

  @ApiPropertyOptional({
    description:
      'Product being upgraded (lowercase catalog slug, e.g. "karafiel"). Defaults to "dhanam".',
    example: 'karafiel',
  })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'product must be a lowercase catalog slug' })
  product?: string;
}

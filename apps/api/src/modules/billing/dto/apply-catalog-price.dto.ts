import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

/**
 * Internal-only payload for Tulana/Selva catalog apply (service-to-service).
 */
export class ApplyCatalogPriceDto {
  @ApiProperty({ example: 'karafiel' })
  @IsString()
  product_slug!: string;

  @ApiProperty({ example: 'contador' })
  @IsString()
  tier_slug!: string;

  @ApiProperty({ description: 'Monthly price in centavos (MXN)', example: 129900 })
  @IsInt()
  @Min(1)
  amount_cents!: number;

  @ApiPropertyOptional({ default: 'MXN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 'month' })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({
    description: 'Dhanam ProductPrice.tierSlug override (defaults to tier_slug)',
  })
  @IsOptional()
  @IsString()
  dhanam_tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  display_name?: string;

  @ApiPropertyOptional({ example: 'tulana_selva' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  recommendation_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approval_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

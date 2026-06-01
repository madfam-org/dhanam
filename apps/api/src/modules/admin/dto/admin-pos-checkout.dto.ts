import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class AdminPosCheckoutDto {
  @ApiProperty({ description: 'Dhanam user id receiving the checkout link' })
  @IsString()
  @Length(1, 128)
  userId!: string;

  @ApiProperty({
    description: 'Plan slug to sell, e.g. pro, pro_yearly, karafiel_contador',
    example: 'karafiel_contador',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*(?:_(?:monthly|yearly|annual))?$/, {
    message: 'plan must be a lowercase catalog plan slug',
  })
  plan!: string;

  @ApiPropertyOptional({
    description: 'MADFAM product slug. Bare plans are normalized to product_plan.',
    default: 'dhanam',
    example: 'karafiel',
  })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'product must be a lowercase catalog slug' })
  product?: string;

  @ApiPropertyOptional({ description: 'Janua/MADFAM organization id to link on checkout' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  orgId?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code for provider routing' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Checkout success URL override' })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  successUrl?: string;

  @ApiPropertyOptional({ description: 'Checkout cancellation URL override' })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  cancelUrl?: string;
}

export class AdminPosStatusDto {
  @ApiProperty({ description: 'Provider checkout session id to inspect' })
  @IsString()
  @Length(1, 256)
  sessionId!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CfdiIssuedDto {
  @ApiProperty({ description: 'Stripe PaymentIntent id (pi_*) used as CFDI idempotency key' })
  @IsString()
  @MinLength(3)
  payment_id!: string;

  @ApiProperty({ description: 'SAT-stamped CFDI UUID from Karafiel' })
  @IsString()
  @MinLength(8)
  cfdi_uuid!: string;

  @ApiPropertyOptional({ description: 'Emitting system identifier' })
  @IsOptional()
  @IsString()
  source?: string;
}

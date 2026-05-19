import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

import { Currency } from '@db';

export class CreateMerchantDto {
  @ApiProperty({ example: 'US' })
  @IsString()
  country!: string;

  @ApiProperty({ enum: ['MXN', 'USD', 'EUR', 'CAD'] })
  @IsEnum(['MXN', 'USD', 'EUR', 'CAD'])
  defaultCurrency!: Currency;

  @ApiProperty({ required: false, enum: ['individual', 'company'] })
  @IsOptional()
  @IsEnum(['individual', 'company'])
  businessType?: 'individual' | 'company';

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, string>;
}

export class OnboardingLinkDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  returnUrl!: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  refreshUrl!: string;
}

export class CreateDestinationChargeDto {
  @ApiProperty({ description: 'Amount in smallest currency unit (e.g. cents)' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['MXN', 'USD', 'EUR', 'CAD'] })
  @IsEnum(['MXN', 'USD', 'EUR', 'CAD'])
  currency!: Currency;

  @ApiProperty()
  @IsString()
  merchantId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  applicationFeeAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: ['automatic', 'manual'] })
  @IsOptional()
  @IsEnum(['automatic', 'manual'])
  captureMethod?: 'automatic' | 'manual';

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, string>;
}

export class CreateTransferDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['MXN', 'USD', 'EUR', 'CAD'] })
  @IsEnum(['MXN', 'USD', 'EUR', 'CAD'])
  currency!: Currency;

  @ApiProperty()
  @IsString()
  merchantId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceChargeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, string>;
}

export class CreatePayoutDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['MXN', 'USD', 'EUR', 'CAD'] })
  @IsEnum(['MXN', 'USD', 'EUR', 'CAD'])
  currency!: Currency;

  @ApiProperty()
  @IsString()
  merchantId!: string;

  @ApiProperty({ required: false, enum: ['standard', 'instant'] })
  @IsOptional()
  @IsEnum(['standard', 'instant'])
  method?: 'standard' | 'instant';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class SubmitDisputeEvidenceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerCommunication?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receipt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shippingDocumentation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uncategorizedText?: string;

  // Index signature mirrors `DisputeEvidence` in
  // billing/services/payment-processor.interface.ts so the DTO stays
  // structurally assignable without losing the documented fields above.
  [key: string]: string | undefined;
}

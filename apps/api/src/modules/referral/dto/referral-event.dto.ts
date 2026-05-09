import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * NOTE: `ReferralConversionDataDto` is declared BEFORE `ReferralConversionWebhookDto`
 * intentionally. With `emitDecoratorMetadata: true`, ts-jest emits a runtime
 * `Reflect.metadata("design:type", ReferralConversionDataDto)` call at the
 * `data: ReferralConversionDataDto` property in `ReferralConversionWebhookDto`,
 * which evaluates the class reference at class-construction time. If the
 * referenced class is declared later in the file, suite-load fails with
 * `ReferenceError: Cannot access 'ReferralConversionDataDto' before initialization`
 * (TDZ). Keep this order. See dhanam-debt-2026-04-27.md cause #4.
 */
export class ReferralConversionDataDto {
  @ApiProperty({ description: 'The referral code used', example: 'MADFAM-A1B2C3D4' })
  @IsString()
  referral_code: string;

  @ApiProperty({ description: 'User ID of the referrer' })
  @IsString()
  referrer_user_id: string;

  @ApiProperty({ description: 'User ID of the referred user' })
  @IsString()
  referred_user_id: string;

  @ApiProperty({ description: 'Product where the referral originated', example: 'dhanam' })
  @IsString()
  source_product: string;

  @ApiProperty({ description: 'Product the referred user signed up for', example: 'karafiel' })
  @IsString()
  target_product: string;

  @ApiProperty({ description: 'Plan ID of the subscription', required: false })
  @IsOptional()
  @IsString()
  plan_id?: string;

  @ApiProperty({ description: 'Revenue in cents', required: false })
  @IsOptional()
  @IsNumber()
  revenue_cents?: number;
}

/**
 * Payload for the `referral.converted` webhook from PhyndCRM.
 * Received via HMAC-authenticated POST /v1/referral/reward.
 */
export class ReferralConversionWebhookDto {
  @ApiProperty({ description: 'Event type', example: 'referral.converted' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Conversion data payload' })
  data: ReferralConversionDataDto;
}

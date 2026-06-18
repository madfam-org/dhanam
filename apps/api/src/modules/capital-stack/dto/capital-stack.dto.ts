import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { CapitalPurpose, Currency, OwnerCapitalFlowType } from '@db';

export class CreateJournalDto {
  @ApiProperty()
  @IsUUID()
  entityGroupId: string;

  @ApiProperty({ enum: OwnerCapitalFlowType })
  @IsEnum(OwnerCapitalFlowType)
  flowType: OwnerCapitalFlowType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceSpaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetSpaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MatchJournalDto {
  @ApiProperty()
  @IsUUID()
  targetTransactionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetSpaceId?: string;
}

export class UpdateCapitalPurposeDto {
  @ApiProperty({ enum: CapitalPurpose })
  @IsEnum(CapitalPurpose)
  capitalPurpose: CapitalPurpose;
}

export class ResolveJournalDto {
  @ApiProperty({ enum: ['sealed', 'void'] })
  @IsString()
  resolution: 'sealed' | 'void';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  karafielCaseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CapitalFlowResolvedDto {
  @ApiProperty()
  @IsUUID()
  correlation_id: string;

  @ApiProperty()
  @IsString()
  karafiel_case_id: string;

  @ApiProperty()
  @IsString()
  resolution: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cfdi_uuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sealed_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operator_notes?: string;

  @ApiPropertyOptional({ default: 'karafiel' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class KarafielManualActionDto {
  @ApiProperty()
  @IsUUID()
  correlation_id: string;

  @ApiProperty()
  @IsString()
  karafiel_case_id: string;

  @ApiProperty()
  @IsString()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actor_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 'karafiel' })
  @IsOptional()
  @IsString()
  source?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MadfamImportPlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Business RFC for CSV routing (never commit to git)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  businessRfc?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  spaceNameBusiness?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  spaceNamePartner?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  spaceNamePersonal?: string | null;

  @ApiPropertyOptional({ example: '-afac' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountSuffixPartner?: string | null;

  @ApiPropertyOptional({ example: '-personal' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountSuffixPersonal?: string | null;
}

export class PlatformConfigEntryDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  scope!: string;

  @ApiProperty()
  scopeId!: string;

  @ApiProperty()
  value!: unknown;

  @ApiPropertyOptional()
  updatedBy!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}

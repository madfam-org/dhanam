import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LunchMoneyPreflightDto {
  @ApiProperty({ description: 'LunchMoney developer API token' })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  apiToken!: string;

  @ApiPropertyOptional({
    description: 'Transaction history start date (YYYY-MM-DD)',
    example: '2020-01-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
}

export class LunchMoneyStartImportDto extends LunchMoneyPreflightDto {
  @ApiPropertyOptional({ description: 'Override LM budget label in Dhanam' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  budgetLabel?: string;
}
